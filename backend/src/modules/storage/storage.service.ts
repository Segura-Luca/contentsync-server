import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';

export interface PresignedUploadResult {
  uploadUrl: string;
  publicUrl: string;
  storageKey: string;
  expiresInSeconds: number;
  resumableHeaders: Record<string, string>;
}

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT') || 'http://localhost:9000';
    const region = this.configService.get<string>('S3_REGION') || 'us-east-1';
    this.bucket = this.configService.get<string>('S3_BUCKET') || 'contentsync-videos';
    this.publicBaseUrl =
      this.configService.get<string>('S3_PUBLIC_URL') || `${endpoint}/${this.bucket}`;

    this.s3Client = new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.configService.get<string>('S3_ACCESS_KEY') || 'minioadmin',
        secretAccessKey: this.configService.get<string>('S3_SECRET_KEY') || 'minioadmin123',
      },
    });
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

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

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

  async createPresignedDownloadUrl(storageKey: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }

  getPublicUrl(storageKey: string): string {
    return `${this.publicBaseUrl}/${storageKey}`;
  }
}
