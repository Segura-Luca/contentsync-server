/** Módulo global que comparte con toda la aplicación la configuración, el correo y la protección OAuth. */
import { Global, Module } from '@nestjs/common';
import { MailService } from '../common/mail/mail.service';
import { OAuthStateService } from '../common/utils/oauth-state.service';
import { AppConfigService } from './app-config.service';

@Global()
@Module({
  providers: [AppConfigService, MailService, OAuthStateService],
  exports: [AppConfigService, MailService, OAuthStateService],
})
export class AppConfigModule {}
