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
import { extname, join } from 'path';
import {
  AuthenticatedUser,
  CurrentUser,
  Roles,
} from '../../common/decorators/auth.decorators';
import { CreateVideoDto, RequestPresignedUrlDto } from './dto/video.dto';
import { VideosService } from './videos.service';

const UPLOAD_DIR = join(__dirname, '..', '..', '..', 'public', 'uploads', 'videos');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

interface UploadedVideoDiskFile {
  filename: string;
  originalname: string;
  size: number;
  mimetype: string;
  path: string;
}

@ApiTags('Videos y Almacenamiento')
@ApiBearerAuth('jwt-auth')
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Post('upload-file')
  @UseInterceptors(
    FileInterceptor('file', {
      dest: UPLOAD_DIR,
      limits: { fileSize: 500 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary:
      'Subir archivo de video real desde el equipo hacia el almacenamiento del estudio (usado desde los bloques del Plan)',
  })
  uploadVideoFile(@UploadedFile() file: UploadedVideoDiskFile | undefined) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo de video.');
    }
    const ext = extname(file.originalname || '.mp4').toLowerCase() || '.mp4';
    const safeExt = ['.mp4', '.mov', '.webm'].includes(ext) ? ext : '.mp4';
    const finalName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${safeExt}`;
    const finalPath = join(UPLOAD_DIR, finalName);
    fs.renameSync(file.path, finalPath);

    const storageKey = `/uploads/videos/${finalName}`;
    return {
      storageKey,
      publicUrl: storageKey,
      sizeBytes: file.size,
      mimeType: file.mimetype || 'video/mp4',
      originalName: file.originalname,
    };
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
