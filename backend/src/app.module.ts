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
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PlatformsModule } from './modules/platforms/platforms.module';
import { PublicationsModule } from './modules/publications/publications.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { SettingsModule } from './modules/settings/settings.module';
import { VideosModule } from './modules/videos/videos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
      validate: validateEnv,
    }),
    AppConfigModule,
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
    VideosModule,
    SchedulesModule,
    PlatformsModule,
    PublicationsModule,
    NotificationsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
