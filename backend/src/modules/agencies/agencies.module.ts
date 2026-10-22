import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { AgenciesController } from './agencies.controller';
import { AgenciesService } from './agencies.service';

@Module({
  controllers: [AgenciesController],
  providers: [AgenciesService, AuditService],
  exports: [AgenciesService],
})
export class AgenciesModule {}
