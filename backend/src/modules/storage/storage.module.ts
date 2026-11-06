/** Módulo de almacenamiento de archivos, usado por autenticación, subidas y cronogramas. */
import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';

@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
