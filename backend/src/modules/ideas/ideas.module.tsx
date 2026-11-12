/** Módulo de ideas: banco privado de ideas de la agencia y propuestas enviadas por los clientes. */
import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { IdeaProposalsController } from './idea-proposals.controller';
import { IdeaProposalsService } from './idea-proposals.service';
import { IdeasController } from './ideas.controller';
import { IdeasService } from './ideas.service';

@Module({
  imports: [NotificationsModule],
  controllers: [IdeasController, IdeaProposalsController],
  providers: [IdeasService, IdeaProposalsService, AuditService],
  exports: [IdeasService],
})
export class IdeasModule {}
