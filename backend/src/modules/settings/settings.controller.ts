import { Body, Controller, Delete, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { AuthenticatedUser, CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AppConfigService } from '../../config/app-config.service';
import { UpdateSettingsDto } from './settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('Configuración de la plataforma (Solo ADMIN_GENERAL)')
@ApiBearerAuth('jwt-auth')
@Roles(RoleCode.ADMIN_GENERAL)
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly config: AppConfigService,
  ) {}

  /** Qué integraciones están activas. Solo informa estados, nunca valores de credenciales. */
  private integrationStatus() {
    const has = (...keys: string[]) => keys.every((key) => Boolean(this.config.get(key)));
    return {
      database: 'MySQL',
      publicUrl: this.config.publicBaseUrl(),
      mail: {
        n8n: has('N8N_WEBHOOK_URL'),
        httpsRelay: has('GMAIL_HTTPS_WEBHOOK_URL'),
        smtp: has('SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'),
        senderAddress: this.config.mailSenderAddress ?? null,
      },
      login: {
        google: has('GOOGLE_AUTH_CLIENT_ID'),
        facebook: has('FACEBOOK_AUTH_APP_ID', 'FACEBOOK_AUTH_APP_SECRET'),
        github: has('GITHUB_AUTH_CLIENT_ID', 'GITHUB_AUTH_CLIENT_SECRET'),
      },
      storage: has('S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY') ? 'S3' : 'LOCAL',
      uploadMaxMb: Math.round(this.config.uploadMaxBytes / (1024 * 1024)),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Ver ajustes editables y estado de las integraciones' })
  get() {
    return { settings: this.settingsService.current(), integrations: this.integrationStatus() };
  }

  @Patch()
  @ApiOperation({ summary: 'Actualizar ajustes (se aplican sin reiniciar el servidor)' })
  async update(@Body() dto: UpdateSettingsDto, @CurrentUser() user: AuthenticatedUser) {
    return { settings: await this.settingsService.update(dto, user.sub), integrations: this.integrationStatus() };
  }

  @Delete()
  @ApiOperation({ summary: 'Restablecer los ajustes de fábrica' })
  async reset(@CurrentUser() user: AuthenticatedUser) {
    return { settings: await this.settingsService.reset(user.sub), integrations: this.integrationStatus() };
  }
}
