/** Actualización en tiempo real: registra el canal y el interceptor global que lo alimenta. */
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LiveController } from './live.controller';
import { LiveInterceptor } from './live.interceptor';
import { LiveService } from './live.service';

@Module({
  controllers: [LiveController],
  providers: [LiveService, { provide: APP_INTERCEPTOR, useClass: LiveInterceptor }],
})
export class LiveModule {}
