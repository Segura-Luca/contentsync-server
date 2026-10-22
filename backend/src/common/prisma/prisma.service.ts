import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    try {
      await this.$connect();
      this.logger.log('Conexión establecida con PostgreSQL (Esquema 3FN)');
    } catch (error) {
      this.logger.warn(
        'PostgreSQL no disponible en este instante; se reintentará al recibir consultas.',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
