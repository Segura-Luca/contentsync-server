/**
 * Módulo de clientes: alta de clientes y confirmación de identidad "Sí, soy yo".
 * Exporta ClientsService porque otros módulos usan assertClientAccess para validar permisos.
 */
import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ClientsController],
  providers: [ClientsService, AuditService],
  exports: [ClientsService],
})
export class ClientsModule {}
