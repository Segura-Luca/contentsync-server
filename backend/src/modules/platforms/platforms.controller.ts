import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { SocialPlatform } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Request, Response } from 'express';
import {
  AuthenticatedUser,
  CurrentUser,
  Public,
} from '../../common/decorators/auth.decorators';
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
  @MaxLength(180)
  externalAccountId!: string;

  @ApiProperty({ example: '@kafecitoroasters' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
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

  @Public()
  @Get('oauth/config')
  @ApiOperation({
    summary: 'Consultar qué proveedores OAuth de plataformas están configurados',
  })
  getOAuthConfig() {
    return this.platformsService.getPlatformOAuthConfig();
  }

  @Get('oauth/:platform/url')
  @ApiOperation({
    summary:
      'Generar URL real de autorización OAuth 2.0 para conectar YouTube Shorts, Instagram Reels o TikTok',
  })
  async getOAuthAuthorizeUrl(
    @Param('platform') platform: string,
    @Query('clientId', ParseUUIDPipe) clientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const url = await this.platformsService.getOAuthAuthorizeUrl({
      platform,
      clientId,
      requestBase: `${req.protocol}://${req.get('host')}`,
      user,
    });
    return { url };
  }

  @Public()
  @Get('oauth/:platform/callback')
  @ApiOperation({
    summary:
      'Callback OAuth 2.0 real para vincular canal de YouTube, cuenta de Instagram o TikTok al cliente',
  })
  async handleOAuthCallback(
    @Param('platform') platform: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    if (error || !code) {
      return res.redirect(
        `/?platform_error=${encodeURIComponent('No se completó la autorización con la red social.')}`,
      );
    }

    try {
      const conn = await this.platformsService.handleOAuthCallback({
        platform,
        code,
        state,
      });
      return res.redirect(
        `/?platform_connected=${encodeURIComponent(conn.platform)}&handle=${encodeURIComponent(conn.accountHandle)}`,
      );
    } catch (err: any) {
      const msg = err?.message || 'Error al vincular la cuenta de la red social.';
      return res.redirect(`/?platform_error=${encodeURIComponent(msg)}`);
    }
  }

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
    @Param('platform', new ParseEnumPipe(SocialPlatform)) platform: SocialPlatform,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.platformsService.revokePlatformConnection(clientId, platform, user);
  }
}
