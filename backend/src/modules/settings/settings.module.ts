/** Módulo global de ajustes: reglas de negocio editables desde la aplicación, sin reiniciar el servidor. */
import { Global, Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Global()
@Module({
  controllers: [SettingsController],
  providers: [SettingsService, AuditService],
  exports: [SettingsService],
})
export class SettingsModule {}
