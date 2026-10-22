import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import {
  AuthenticatedUser,
  CurrentUser,
  Roles,
} from '../../common/decorators/auth.decorators';
import { CreateVideoDto, RequestPresignedUrlDto } from './dto/video.dto';
import { VideosService } from './videos.service';

@ApiTags('Videos y Almacenamiento S3')
@ApiBearerAuth('jwt-auth')
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

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
  @ApiOperation({ summary: 'Obtener detalle completo de un video, comentarios, aprobaciones y estado por plataforma' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.videosService.findOneWithAccess(id, user);
  }
}
