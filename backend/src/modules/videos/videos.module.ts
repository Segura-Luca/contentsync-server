import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ClientsModule } from '../clients/clients.module';
import { StorageService } from '../storage/storage.service';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';

@Module({
  imports: [ClientsModule],
  controllers: [VideosController],
  providers: [VideosService, StorageService, AuditService],
  exports: [VideosService, StorageService],
})
export class VideosModule {}
