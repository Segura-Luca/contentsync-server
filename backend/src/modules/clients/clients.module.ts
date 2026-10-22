import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  controllers: [ClientsController],
  providers: [ClientsService, AuditService],
  exports: [ClientsService],
})
export class ClientsModule {}
