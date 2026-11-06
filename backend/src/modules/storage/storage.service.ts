/** Guarda, borra y genera enlaces de archivos, en S3 o en el disco del servidor. */
import { Injectable, Logger, PayloadTooLargeException, ServiceUnavailableException } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { basename, join } from 'path';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';

// Las claves con este prefijo son archivos en disco; las que empiezan con clients/ están en S3.
const LOCAL_KEY_PREFIX = '/uploads/videos/';
// Reintentos de subida a S3 y espera base entre ellos.
const UPLOAD_ATTEMPTS = 3;
const UPLOAD_RETRY_DELAY_MS = 1000;
/** Los archivos solo se ven desde la plataforma: el enlace firmado vence y la app pide otro al cargar. */
const SIGNED_URL_SECONDS = 12 * 60 * 60;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** Nombre del bucket de S3. */
  private get bucket(): string {
    return this.config.get('S3_BUCKET') || 'contentsync-videos';
  }

  /** Crea una sola vez el cliente de S3. Falla con un mensaje claro si faltan credenciales. */
  private s3(): S3Client {
    if (this.s3Client) return this.s3Client;
    const endpoint = this.config.get('S3_ENDPOINT');
    const accessKeyId = this.config.get('S3_ACCESS_KEY');
    const secretAccessKey = this.config.get('S3_SECRET_KEY');
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException(
        'El almacenamiento S3 no está configurado: definí S3_ENDPOINT, S3_ACCESS_KEY y S3_SECRET_KEY.',
      );
    }
    this.s3Client = new S3Client({
      region: this.config.get('S3_REGION') || 'us-east-1',
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
      // Los servicios compatibles con S3 (Supabase, R2) no siempre aceptan las sumas de verificación por defecto del SDK.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    return this.s3Client;
  }

  /** Con S3 configurado los archivos sobreviven a los reinicios; sin él quedan en el disco del servidor. */
  get usesS3(): boolean {
    return ['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'].every((key) => Boolean(this.config.get(key)));
  }

  /** Copia un archivo ya validado a la carpeta del cliente, sin cargarlo entero en memoria. */
  async uploadObject(params: {
    clientId: string;
    localPath: string;
    extension: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<string> {
    const storageKey = `clients/${params.clientId}/${Date.now()}_${crypto.randomBytes(6).toString('hex')}${params.extension}`;
    for (let attempt = 1; ; attempt++) {
      // Un flujo ya leído no se puede reenviar: cada intento abre el archivo de nuevo.
      const body = fs.createReadStream(params.localPath);
      // Sin este oyente, un error de lectura tumbaría el proceso. El SDK ya rechaza la subida.
      body.on('error', () => undefined);
      try {
        await this.s3().send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: storageKey,
            Body: body,
            ContentType: params.mimeType,
            ContentLength: params.sizeBytes,
          }),
        );
        return storageKey;
      } catch (error: any) {
        const status = error?.$metadata?.httpStatusCode;
        if (error?.name === 'EntityTooLarge' || status === 413) {
          throw new PayloadTooLargeException('El archivo supera el tamaño máximo que admite el almacenamiento.');
        }
        this.logger.error(`No se pudo guardar el archivo en S3 (intento ${attempt}): ${error?.name}: ${error?.message}`);
        // Un 4xx no cambia al reintentar. Repetir es seguro: la misma clave se sobrescribe.
        const transient = !(status >= 400 && status < 500);
        if (!transient || attempt >= UPLOAD_ATTEMPTS) {
          throw new ServiceUnavailableException('No se pudo guardar el archivo en el almacenamiento. Probá de nuevo en unos minutos.');
        }
        await new Promise((resolve) => setTimeout(resolve, UPLOAD_RETRY_DELAY_MS * attempt));
      } finally {
        body.destroy();
      }
    }
  }

  /** Borra un archivo del disco o de S3. basename evita salir de la carpeta de subidas. */
  async deleteObject(storageKey: string): Promise<void> {
    if (storageKey.startsWith(LOCAL_KEY_PREFIX)) {
      fs.rmSync(join(this.config.uploadDir, basename(storageKey)), { force: true });
      return;
    }
    // Las URL externas y los datos de demostración no son archivos nuestros.
    if (!storageKey.startsWith('clients/') || !this.usesS3) return;
    await this.s3().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
  }

  /**
   * Borra los archivos que ya ningún bloque usa: duplicar una semana comparte el archivo entre bloques.
   * Un fallo acá solo deja un archivo huérfano, así que no debe interrumpir a quien llama.
   */
  async deleteIfUnused(storageKeys: string[]): Promise<void> {
    for (const storageKey of new Set(storageKeys)) {
      try {
        const stillUsed = await this.prisma.scheduleItemMedia.count({ where: { storageKey } });
        if (!stillUsed) await this.deleteObject(storageKey);
      } catch (error: any) {
        this.logger.error(`No se pudo borrar un archivo sin uso: ${error?.name}: ${error?.message}`);
      }
    }
  }

  /** Una clave solo puede apuntar a una subida local o a la carpeta S3 de ese cliente. */
  isValidStorageKey(storageKey: string, clientId: string): boolean {
    if (storageKey.startsWith(LOCAL_KEY_PREFIX)) {
      return /^[\w.-]+$/.test(storageKey.slice(LOCAL_KEY_PREFIX.length));
    }
    return /^clients\/[\w-]+\/[\w.-]+$/.test(storageKey) && storageKey.startsWith(`clients/${clientId}/`);
  }

  /** Enlace para ver el archivo dentro de la plataforma. Los de S3 son temporales: el bucket puede ser privado. */
  async getMediaUrl(storageKey: string): Promise<string> {
    if (!storageKey) return '';
    if (/^https?:\/\//i.test(storageKey) || storageKey.startsWith(LOCAL_KEY_PREFIX)) return storageKey;
    if (!this.usesS3) return '';
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: storageKey });
    return getSignedUrl(this.s3(), command, { expiresIn: SIGNED_URL_SECONDS });
  }
}
