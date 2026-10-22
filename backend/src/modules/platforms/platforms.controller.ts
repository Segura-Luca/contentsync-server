import { Body, Controller, Delete, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { SocialPlatform } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/auth.decorators';
import { PlatformsService } from './platforms.service';

export class ConnectPlatformDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiProperty({ enum: SocialPlatform })
  @IsEnum(SocialPlatform)
  platform!: SocialPlatform;

  @ApiProperty({ example: 'ig_business_991823' })
  @IsString()
  @IsNotEmpty()
  externalAccountId!: string;

  @ApiProperty({ example: '@kafecitoroasters' })
  @IsString()
  @IsNotEmpty()
  accountHandle!: string;

  @ApiProperty({ description: 'OAuth 2.0 Access Token de la plataforma (se cifra con AES-256-GCM)' })
  @IsString()
  @IsNotEmpty()
  accessToken!: string;

  @ApiPropertyOptional({ description: 'OAuth 2.0 Refresh Token (se cifra con AES-256-GCM)' })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({ example: 5184000 })
  @IsOptional()
  @IsInt()
  @Min(60)
  expiresInSeconds?: number;
}

@ApiTags('Conexiones OAuth de Plataformas (Instagram, TikTok, YouTube)')
@ApiBearerAuth('jwt-auth')
@Controller('platforms')
export class PlatformsController {
  constructor(private readonly platformsService: PlatformsService) {}

  @Post('connect')
  @ApiOperation({
    summary:
      'Vincular cuenta OAuth de Instagram Reels, TikTok o YouTube Shorts de un cliente (cifrado AES-256-GCM)',
  })
  connect(
    @Body() dto: ConnectPlatformDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.platformsService.connectPlatformAccount(dto, user);
  }

  @Delete(':clientId/:platform')
  @ApiOperation({ summary: 'Revocar conexión OAuth de una plataforma para un cliente' })
  revoke(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('platform') platform: SocialPlatform,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.platformsService.revokePlatformConnection(clientId, platform, user);
  }
}
