import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/auth.decorators';
import { NotificationsService } from './notifications.service';

export class RegisterFcmTokenDto {
  @ApiProperty({ example: 'fcm_device_token_android_xyz123' })
  @IsString()
  @IsNotEmpty()
  fcmToken!: string;
}

@ApiTags('Notificaciones Push (FCM e In-App)')
@ApiBearerAuth('jwt-auth')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar notificaciones del usuario autenticado' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.listForUser(user.sub);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.markAsRead(id, user.sub);
  }

  @Post('fcm-token')
  @ApiOperation({ summary: 'Registrar o actualizar token de dispositivo Firebase Cloud Messaging' })
  updateFcmToken(
    @Body() dto: RegisterFcmTokenDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.updateFcmToken(user.sub, dto.fcmToken);
  }
}
