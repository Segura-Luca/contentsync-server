/** Rutas HTTP de archivos (/api/v1/media): subir fotos y videos de los bloques. */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { join } from 'path';
import {
  AuthenticatedUser,
  CurrentUser,
  Roles,
} from '../../common/decorators/auth.decorators';
import { AppConfigService } from '../../config/app-config.service';
import { ClientsService } from '../clients/clients.service';
import { detectMediaFormat } from '../storage/media-format';
import { StorageService } from '../storage/storage.service';

/** Datos del archivo temporal que entrega Multer. */
interface UploadedDiskFile {
  originalname: string;
  size: number;
  path: string;
}

@ApiTags('Fotos y videos de los bloques')
@ApiBearerAuth('jwt-auth')
@Controller('media')
export class MediaController {
  constructor(
    private readonly config: AppConfigService,
    private readonly storage: StorageService,
    private readonly clientsService: ClientsService,
  ) {}

  /**
   * Valida el permiso sobre el cliente y el formato real del archivo, y lo guarda en S3 o en disco.
   * El archivo temporal se elimina siempre al terminar (ver el bloque finally).
   */
  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Subir una foto o un video para mostrarle al cliente dentro de un bloque' })
  async upload(
    @UploadedFile() file: UploadedDiskFile | undefined,
    @Body('clientId') clientId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo.');
    }
    let keepTempFile = false;
    try {
      if (!clientId) {
        throw new BadRequestException('Falta indicar el cliente del archivo.');
      }
      await this.clientsService.assertClientAccess(clientId, user, true);

      const format = detectMediaFormat(file.path);
      if (!format) {
        throw new BadRequestException('Ese archivo no se puede mostrar. Formatos admitidos: JPG, PNG, WEBP, GIF, MP4, MOV y WebM.');
      }

      let storageKey: string;
      // Con S3 se copia al bucket; sin S3 el archivo se mueve a la carpeta de subidas.
      if (this.storage.usesS3) {
        storageKey = await this.storage.uploadObject({
          clientId,
          localPath: file.path,
          extension: format.extension,
          mimeType: format.mimeType,
          sizeBytes: file.size,
        });
      } else {
        const finalName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${format.extension}`;
        fs.renameSync(file.path, join(this.config.uploadDir, finalName));
        keepTempFile = true;
        storageKey = `/uploads/videos/${finalName}`;
      }

      return {
        storageKey,
        url: await this.storage.getMediaUrl(storageKey),
        kind: format.kind,
        mimeType: format.mimeType,
        sizeBytes: file.size,
        originalName: file.originalname,
      };
    } finally {
      if (!keepTempFile) fs.rmSync(file.path, { force: true });
    }
  }

  /** Informa el tamaño máximo permitido, para avisar antes de enviar el archivo. */
  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Get('upload-config')
  @ApiOperation({ summary: 'Tamaño máximo de subida, para avisar antes de enviar el archivo' })
  uploadConfig() {
    return { maxMb: Math.round(this.config.uploadMaxBytes / (1024 * 1024)) };
  }
}
