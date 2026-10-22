import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ClientsModule } from '../clients/clients.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformsModule } from '../platforms/platforms.module';
import { VideosModule } from '../videos/videos.module';
import { PublicationsController } from './publications.controller';
import { PublicationsService } from './publications.service';

@Module({
  imports: [VideosModule, ClientsModule, PlatformsModule, NotificationsModule],
  controllers: [PublicationsController],
  providers: [PublicationsService, AuditService],
  exports: [PublicationsService],
})
export class PublicationsModule {}
