/** Módulo global de base de datos: pone PrismaService a disposición de toda la aplicación sin tener que importarlo. */
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
