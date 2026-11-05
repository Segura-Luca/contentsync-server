import { Injectable, Logger, PayloadTooLargeException, ServiceUnavailableException } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { basename, join } from 'path';
import { readVideoDurationSeconds } from '../../common/utils/video-duration';
import { AppConfigService } from '../../config/app-config.service';

export interface PresignedUploadResult {
  uploadUrl: string;
  publicUrl: string;
  storageKey: string;
  expiresInSeconds: number;
  resumableHeaders: Record<string, string>;
}

const LOCAL_KEY_PREFIX = '/uploads/videos/';
const UPLOAD_ATTEMPTS = 3;
const UPLOAD_RETRY_DELAY_MS = 1000;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get bucket(): string {
    return this.config.get('S3_BUCKET') || 'contentsync-videos';
  }

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

  /** Con S3 configurado los videos sobreviven a los reinicios; sin él quedan en el disco del servidor. */
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
          throw new PayloadTooLargeException('El video supera el tamaño máximo que admite el almacenamiento.');
        }
        this.logger.error(`No se pudo guardar el video en S3 (intento ${attempt}): ${error?.name}: ${error?.message}`);
        // Un 4xx no cambia al reintentar. Repetir es seguro: la misma clave se sobrescribe.
        const transient = !(status >= 400 && status < 500);
        if (!transient || attempt >= UPLOAD_ATTEMPTS) {
          throw new ServiceUnavailableException('No se pudo guardar el video en el almacenamiento. Probá de nuevo en unos minutos.');
        }
        await new Promise((resolve) => setTimeout(resolve, UPLOAD_RETRY_DELAY_MS * attempt));
      } finally {
        body.destroy();
      }
    }
  }

  async deleteObject(storageKey: string): Promise<void> {
    if (storageKey.startsWith(LOCAL_KEY_PREFIX)) {
      fs.rmSync(join(this.config.uploadDir, basename(storageKey)), { force: true });
      return;
    }
    // Las URL externas y los datos de demostración no son archivos nuestros.
    if (!storageKey.startsWith('clients/') || !this.usesS3) return;
    await this.s3().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
  }

  /** Una clave solo puede apuntar a una subida local o a la carpeta S3 de ese cliente. */
  isValidStorageKey(storageKey: string, clientId: string): boolean {
    if (storageKey.startsWith(LOCAL_KEY_PREFIX)) {
      return /^[\w.-]+$/.test(storageKey.slice(LOCAL_KEY_PREFIX.length));
    }
    return /^clients\/[\w-]+\/[\w.-]+$/.test(storageKey) && storageKey.startsWith(`clients/${clientId}/`);
  }

  async createPresignedUploadUrl(params: {
    clientId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<PresignedUploadResult> {
    const safeFileName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueSuffix = crypto.randomBytes(6).toString('hex');
    const storageKey = `clients/${params.clientId}/${Date.now()}_${uniqueSuffix}_${safeFileName}`;
    const expiresInSeconds = 3600;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: params.mimeType,
      ContentLength: params.sizeBytes,
    });
    const uploadUrl = await getSignedUrl(this.s3(), command, { expiresIn: expiresInSeconds });

    return {
      uploadUrl,
      publicUrl: this.getPublicUrl(storageKey),
      storageKey,
      expiresInSeconds,
      resumableHeaders: {
        'Content-Type': params.mimeType,
        'x-amz-Constrained-Size': String(params.sizeBytes),
      },
    };
  }

  /** Duración real leída del archivo guardado. Devuelve null si no se puede determinar. */
  async probeDurationSeconds(storageKey: string): Promise<number | null> {
    try {
      if (storageKey.startsWith(LOCAL_KEY_PREFIX)) {
        const path = join(this.config.uploadDir, basename(storageKey));
        const size = fs.statSync(path).size;
        const descriptor = fs.openSync(path, 'r');
        try {
          return await readVideoDurationSeconds(async (offset, length) => {
            const chunk = Buffer.alloc(length);
            const read = fs.readSync(descriptor, chunk, 0, length, offset);
            return chunk.subarray(0, read);
          }, size);
        } finally {
          fs.closeSync(descriptor);
        }
      }
      const readRange = async (offset: number, length: number) => {
        const res = await this.s3().send(
          new GetObjectCommand({ Bucket: this.bucket, Key: storageKey, Range: `bytes=${offset}-${offset + length - 1}` }),
        );
        return { bytes: Buffer.from(await res.Body!.transformToByteArray()), total: res.ContentRange };
      };
      const first = await readRange(0, 16);
      const total = Number(first.total?.split('/')[1]);
      if (!Number.isFinite(total)) return null;
      return await readVideoDurationSeconds(async (offset, length) => (await readRange(offset, length)).bytes, total);
    } catch {
      return null;
    }
  }

  async createPresignedDownloadUrl(storageKey: string): Promise<string> {
    if (storageKey.startsWith(LOCAL_KEY_PREFIX)) return storageKey;
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: storageKey });
    return getSignedUrl(this.s3(), command, { expiresIn: 3600 });
  }

  private s3PublicUrl(storageKey: string): string {
    const endpoint = this.config.get('S3_ENDPOINT');
    const base = this.config.get('S3_PUBLIC_URL') || (endpoint ? `${endpoint}/${this.bucket}` : '');
    return `${base.replace(/\/+$/, '')}/${storageKey}`;
  }

  /** URL para reproducir en la app. Las subidas locales son relativas: siempre coinciden con el origen y la CSP. */
  getPublicUrl(storageKey: string): string {
    if (!storageKey) return '';
    if (/^https?:\/\//i.test(storageKey) || storageKey.startsWith(LOCAL_KEY_PREFIX)) return storageKey;
    if (storageKey.startsWith('uploads/')) return `/${storageKey}`;
    return this.s3PublicUrl(storageKey);
  }

  /** URL absoluta para las redes sociales, que descargan el archivo desde sus propios servidores. */
  getPublishUrl(storageKey: string): string {
    const url = this.getPublicUrl(storageKey);
    return url.startsWith('/') ? `${this.config.publicBaseUrl()}${url}` : url;
  }
}
