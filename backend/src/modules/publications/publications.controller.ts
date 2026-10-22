import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import {
  AuthenticatedUser,
  CurrentUser,
  Roles,
} from '../../common/decorators/auth.decorators';
import { HistoryFilterDto, ScheduleOrPublishVideoDto } from './dto/publication.dto';
import { PublicationsService } from './publications.service';

@ApiTags('Publicación Multiplataforma, Programación e Historial')
@ApiBearerAuth('jwt-auth')
@Controller('publications')
export class PublicationsController {
  constructor(private readonly publicationsService: PublicationsService) {}

  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Post('publish')
  @ApiOperation({
    summary:
      'Publicar o programar en una sola acción un video APROBADO en Instagram Reels, TikTok y YouTube Shorts',
  })
  scheduleOrPublish(
    @Body() dto: ScheduleOrPublishVideoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.publicationsService.scheduleOrPublishMultiPlatform(dto, user);
  }

  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Post(':publicationId/retry')
  @ApiOperation({ summary: 'Reintentar manualmente una publicación individual con error' })
  retryPublication(@Param('publicationId', ParseUUIDPipe) publicationId: string) {
    return this.publicationsService.executeSinglePlatformPublicationWithRetries(
      publicationId,
    );
  }

  @Get('history')
  @ApiOperation({
    summary:
      'Historial de publicaciones con filtros por semana, cliente, plataforma, estado y buscador',
  })
  getHistory(
    @Query() filters: HistoryFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.publicationsService.getPublicationHistory(filters, user);
  }
}
