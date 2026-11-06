import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { join } from 'path';
import { AppConfigService } from '../../config/app-config.service';
import { ClientsModule } from '../clients/clients.module';
import { StorageModule } from '../storage/storage.module';
import { MediaController } from './media.controller';

@Module({
  imports: [
    ClientsModule,
    StorageModule,
    MulterModule.registerAsync({
      inject: [AppConfigService],
      // La carpeta temporal empieza con punto: los estáticos de Express no sirven archivos ocultos.
      useFactory: (config: AppConfigService) => ({
        dest: join(config.uploadDir, '.tmp'),
        limits: { fileSize: config.uploadMaxBytes },
      }),
    }),
  ],
  controllers: [MediaController],
})
export class MediaModule {}
