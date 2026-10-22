import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ClientsModule } from '../clients/clients.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VideosModule } from '../videos/videos.module';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [ClientsModule, VideosModule, NotificationsModule],
  controllers: [SchedulesController],
  providers: [SchedulesService, AuditService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
