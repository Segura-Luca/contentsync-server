import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
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
import { StorageService } from '../storage/storage.service';
import { CreateVideoDto, RequestPresignedUrlDto } from './dto/video.dto';
import { VideosService } from './videos.service';

/**
 * Identifica el contenedor por sus primeros bytes: el nombre y el tipo MIME los elige quien sube el archivo.
 * MP4 y MOV declaran un átomo en el byte 4; WebM comienza con la firma EBML.
 */
function detectVideoFormat(path: string): { extension: string; mimeType: string } | null {
  const header = Buffer.alloc(12);
  const descriptor = fs.openSync(path, 'r');
  try {
    fs.readSync(descriptor, header, 0, 12, 0);
  } finally {
    fs.closeSync(descriptor);
  }
  if (header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return { extension: '.webm', mimeType: 'video/webm' };
  }
  const atom = header.toString('latin1', 4, 8);
  if (atom === 'ftyp') {
    return header.toString('latin1', 8, 12).startsWith('qt')
      ? { extension: '.mov', mimeType: 'video/quicktime' }
      : { extension: '.mp4', mimeType: 'video/mp4' };
  }
  if (['moov', 'mdat', 'wide', 'free'].includes(atom)) {
    return { extension: '.mov', mimeType: 'video/quicktime' };
  }
  return null;
}

interface UploadedVideoDiskFile {
  filename: string;
  originalname: string;
  size: number;
  path: string;
}

@ApiTags('Videos y Almacenamiento')
@ApiBearerAuth('jwt-auth')
@Controller('videos')
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    private readonly config: AppConfigService,
    private readonly storage: StorageService,
  ) {}

  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Post('upload-file')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'Subir archivo de video real desde el equipo hacia el almacenamiento del estudio (usado desde los bloques del Plan)',
  })
  async uploadVideoFile(
    @UploadedFile() file: UploadedVideoDiskFile | undefined,
    @Body('clientId') clientId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo de video.');
    }
    const format = detectVideoFormat(file.path);
    if (!format) {
      fs.unlinkSync(file.path);
      throw new BadRequestException('El archivo no es un video válido. Formatos admitidos: MP4, MOV y WebM.');
    }
    if (this.storage.usesS3) {
      try {
        if (!clientId) {
          throw new BadRequestException('Falta indicar el cliente del video.');
        }
        await this.videosService.assertCanUpload(clientId, user);
        const storageKey = await this.storage.uploadObject({
          clientId,
          localPath: file.path,
          extension: format.extension,
          mimeType: format.mimeType,
          sizeBytes: file.size,
        });
        return {
          storageKey,
          publicUrl: this.storage.getPublicUrl(storageKey),
          sizeBytes: file.size,
          mimeType: format.mimeType,
          originalName: file.originalname,
        };
      } finally {
        fs.rmSync(file.path, { force: true });
      }
    }

    const finalName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${format.extension}`;
    fs.renameSync(file.path, join(this.config.uploadDir, finalName));

    const storageKey = `/uploads/videos/${finalName}`;
    return {
      storageKey,
      publicUrl: storageKey,
      sizeBytes: file.size,
      mimeType: format.mimeType,
      originalName: file.originalname,
    };
  }

  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Get('upload-config')
  @ApiOperation({ summary: 'Tamaño máximo de subida, para avisar antes de enviar el archivo' })
  uploadConfig() {
    return { maxMb: Math.round(this.config.uploadMaxBytes / (1024 * 1024)) };
  }

  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Post('presigned-upload')
  @ApiOperation({
    summary:
      'Validar formato/duración/tamaño por plataforma y generar URL prefirmada S3 para subida reanudable',
  })
  requestPresignedUpload(
    @Body() dto: RequestPresignedUrlDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.videosService.requestPresignedUpload(dto, user);
  }

  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Post()
  @ApiOperation({
    summary:
      'Registrar metadatos del video, hashtags y configuración específica por plataforma (Instagram, TikTok, YouTube)',
  })
  create(@Body() dto: CreateVideoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.videosService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar videos según alcance del rol' })
  @ApiQuery({ name: 'clientId', required: false })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clientId') clientId?: string,
  ) {
    return this.videosService.findAllForUser(user, clientId);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Obtener detalle completo de un video, comentarios, aprobaciones y estado por plataforma',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.videosService.findOneWithAccess(id, user);
  }
}
