import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { IdeasController } from './ideas.controller';
import { IdeasService } from './ideas.service';

@Module({
  controllers: [IdeasController],
  providers: [IdeasService, AuditService],
  exports: [IdeasService],
})
export class IdeasModule {}
