import { MulterModule } from '@nestjs/platform-express';
import { join } from 'path';
import { AppConfigService } from '../../config/app-config.service';
import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ClientsModule } from '../clients/clients.module';
import { StorageService } from '../storage/storage.service';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';

@Module({
  imports: [
    ClientsModule,
    MulterModule.registerAsync({
      inject: [AppConfigService],
      // La carpeta temporal empieza con punto: los estáticos de Express no sirven archivos ocultos.
      useFactory: (config: AppConfigService) => ({
        dest: join(config.uploadDir, '.tmp'),
        limits: { fileSize: config.uploadMaxBytes },
      }),
    }),
  ],
  controllers: [VideosController],
  providers: [VideosService, StorageService, AuditService],
  exports: [VideosService, StorageService],
})
export class VideosModule {}
