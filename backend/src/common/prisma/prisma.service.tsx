/** Cliente de base de datos usado por toda la aplicación. Controla la conexión a MySQL durante la vida del servidor. */
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /** Conecta al arrancar. Si MySQL todavía no responde, avisa y sigue: Prisma reintenta en la primera consulta. */
  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    try {
      await this.$connect();
      this.logger.log('Conexión establecida con MySQL (Esquema 3FN)');
    } catch (error) {
      this.logger.warn(
        'MySQL no disponible en este instante; se reintentará al recibir consultas.',
      );
    }
  }

  /** Cierra la conexión al apagar el servidor. */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
