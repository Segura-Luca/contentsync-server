/**
 * Módulo raíz: reúne todos los módulos de la aplicación y registra las protecciones
 * que se aplican a TODAS las rutas sin tener que repetirlas en cada controlador.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AUTH_THROTTLE_KEY } from './common/decorators/auth-throttle.decorator';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { JwtAuthGuard, RolesGuard } from './common/guards/auth-rbac.guards';
import { PrismaModule } from './common/prisma/prisma.module';
import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import { validateEnv } from './config/env.validation';
import { AgenciesModule } from './modules/agencies/agencies.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClientsModule } from './modules/clients/clients.module';
import { IdeasModule } from './modules/ideas/ideas.module';
import { MediaModule } from './modules/media/media.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { SettingsModule } from './modules/settings/settings.module';

/** Declara qué módulos componen la aplicación y qué protecciones globales usa. */
@Module({
  imports: [
    // Lee las variables de entorno de .env y las valida al arrancar: si son inválidas, el servidor no inicia.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
      validate: validateEnv,
    }),
    AppConfigModule,
    // Límite de peticiones por minuto: uno general y otro estricto solo para rutas marcadas con @AuthThrottle().
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => [
        { name: 'default', ttl: 60000, limit: config.rateLimitPerMinute },
        {
          name: 'auth',
          ttl: 60000,
          limit: config.authRateLimitPerMinute,
          skipIf: (context) => !Reflect.getMetadata(AUTH_THROTTLE_KEY, context.getHandler()),
        },
      ],
    }),
    PrismaModule,
    SettingsModule,
    AuthModule,
    AgenciesModule,
    ClientsModule,
    IdeasModule,
    MediaModule,
    SchedulesModule,
    NotificationsModule,
  ],
  // Se ejecutan en este orden: límite de peticiones, autenticación JWT y control de roles. El filtro traduce errores de Prisma.
  providers: [
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
