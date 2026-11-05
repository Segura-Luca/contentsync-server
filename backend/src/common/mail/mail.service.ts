import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { AppConfigService } from '../../config/app-config.service';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Datos adicionales para el flujo n8n (código OTP, propósito, nombre). */
  meta?: Record<string, unknown>;
}

export type MailTransport = 'n8n' | 'https' | 'smtp';

const REQUEST_TIMEOUT_MS = 10000;

/**
 * Envío de correo con transportes en cascada. El orden se configura con
 * MAIL_TRANSPORTS_OTP y MAIL_TRANSPORTS_GENERAL; un transporte sin credenciales se omite.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: AppConfigService) {}

  private order(kind: 'otp' | 'general'): MailTransport[] {
    const key = kind === 'otp' ? 'MAIL_TRANSPORTS_OTP' : 'MAIL_TRANSPORTS_GENERAL';
    // SMTP va último: Render bloquea esos puertos en el plan gratuito.
    return (this.config.getRaw(key) || 'n8n,https,smtp')
      .split(',')
      .map((transport) => transport.trim().toLowerCase())
      .filter((transport): transport is MailTransport => ['n8n', 'https', 'smtp'].includes(transport));
  }

  private smtp(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;
    const host = this.config.get('SMTP_HOST');
    const user = this.config.get('SMTP_USER');
    const pass = this.config.get('SMTP_PASS');
    if (!host || !user || !pass) return null;
    const port = Number(this.config.getRaw('SMTP_PORT') || 587);
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: this.config.getRaw('SMTP_SECURE') === 'true' || port === 465,
      auth: { user, pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
    });
    return this.transporter;
  }

  private async postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  private async sendWith(transport: MailTransport, mail: OutgoingMail, fromName: string): Promise<boolean> {
    if (transport === 'n8n') {
      const url = this.config.get('N8N_WEBHOOK_URL');
      if (!url) return false;
      const secret = this.config.get('N8N_WEBHOOK_SECRET');
      await this.postJson(
        url,
        {
          email: mail.to,
          to: mail.to,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          senderEmail: this.config.mailSenderAddress,
          fromName,
          ...(mail.meta || {}),
        },
        secret ? { 'X-Webhook-Secret': secret } : {},
      );
      return true;
    }
    if (transport === 'https') {
      const url = this.config.get('GMAIL_HTTPS_WEBHOOK_URL');
      if (!url) return false;
      await this.postJson(url, {
        secret: this.config.getRaw('GMAIL_WEBHOOK_SECRET') || '',
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        fromName,
      });
      return true;
    }
    const smtp = this.smtp();
    if (!smtp) return false;
    const address = this.config.mailSenderAddress;
    await smtp.sendMail({
      from: this.config.getRaw('SMTP_FROM') || (address ? `"${fromName}" <${address}>` : undefined),
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return true;
  }

  /** Devuelve true si algún transporte aceptó el mensaje. En producción nunca registra su contenido. */
  async send(kind: 'otp' | 'general', mail: OutgoingMail, fromName = 'ContentSync'): Promise<boolean> {
    for (const transport of this.order(kind)) {
      try {
        if (await this.sendWith(transport, mail, fromName)) {
          this.logger.log(`[${transport}] Correo "${String(mail.meta?.purpose ?? kind)}" enviado.`);
          return true;
        }
      } catch (err) {
        this.logger.warn(`[${transport}] Falló el envío: ${(err as Error).message}`);
      }
    }
    if (this.config.isProduction) {
      this.logger.error('No se pudo enviar el correo: ningún transporte disponible respondió.');
    } else {
      this.logger.warn(`[MAIL DEV] Sin transporte disponible. Para ${mail.to}:\n${mail.text}`);
    }
    return false;
  }
}
