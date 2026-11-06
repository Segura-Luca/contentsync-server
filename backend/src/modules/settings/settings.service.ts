import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { isValidTimeZone } from '../../common/utils/timezone';
import { AppConfigService } from '../../config/app-config.service';
import { cloneDefaultSettings, RuntimeSettings } from './settings.defaults';
import { UpdateSettingsDto } from './settings.dto';

/**
 * Ajustes guardados en MySQL y mantenidos en memoria para leerlos de forma síncrona.
 * La instantánea se refresca periódicamente para propagar cambios entre instancias.
 */
@Injectable()
export class SettingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SettingsService.name);
  private snapshot: RuntimeSettings = cloneDefaultSettings();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly config: AppConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
    this.timer = setInterval(() => void this.reload(), this.config.settingsRefreshSeconds * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  current(): RuntimeSettings {
    return this.snapshot;
  }

  private merge(overrides: Record<string, unknown>): RuntimeSettings {
    const merged = cloneDefaultSettings();
    const target = merged as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(overrides)) {
      if (!(key in target)) continue;
      target[key] = value;
    }
    return merged;
  }

  async reload(): Promise<void> {
    try {
      const rows = (await this.prisma.appSetting.findMany()) ?? [];
      const overrides: Record<string, unknown> = {};
      for (const row of rows) {
        try {
          overrides[row.key] = JSON.parse(row.value);
        } catch {
          this.logger.warn(`Ajuste "${row.key}" ignorado: su valor no es JSON válido.`);
        }
      }
      this.snapshot = this.merge(overrides);
    } catch (err) {
      this.logger.warn(`No se pudieron leer los ajustes: ${(err as Error).message}`);
    }
  }

  async update(dto: UpdateSettingsDto, userId: string): Promise<RuntimeSettings> {
    if (dto.defaultTimezone && !isValidTimeZone(dto.defaultTimezone)) {
      throw new BadRequestException(`Zona horaria desconocida: ${dto.defaultTimezone}.`);
    }
    const values: Record<string, unknown> = { ...dto };
    if (dto.appName !== undefined) values.appName = dto.appName.trim();
    const entries = Object.entries(values).filter(([, value]) => value !== undefined);
    await this.prisma.$transaction(
      entries.map(([key, value]) =>
        this.prisma.appSetting.upsert({
          where: { key },
          update: { value: JSON.stringify(value), updatedByUserId: userId },
          create: { key, value: JSON.stringify(value), updatedByUserId: userId },
        }),
      ),
    );
    await this.reload();
    await this.auditService.log({
      userId,
      action: 'SETTINGS_UPDATED',
      entityType: 'AppSetting',
      metadata: { keys: entries.map(([key]) => key) },
    });
    return this.current();
  }

  /** Borra los ajustes guardados y vuelve a los valores de fábrica. */
  async reset(userId: string): Promise<RuntimeSettings> {
    await this.prisma.appSetting.deleteMany();
    await this.reload();
    await this.auditService.log({ userId, action: 'SETTINGS_RESET', entityType: 'AppSetting' });
    return this.current();
  }
}
