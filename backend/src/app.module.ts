import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard } from './common/guards/auth-rbac.guards';
import { PrismaModule } from './common/prisma/prisma.module';
import { AgenciesModule } from './modules/agencies/agencies.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClientsModule } from './modules/clients/clients.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PlatformsModule } from './modules/platforms/platforms.module';
import { PublicationsModule } from './modules/publications/publications.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { VideosModule } from './modules/videos/videos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env', '../.env.example'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
    PrismaModule,
    AuthModule,
    AgenciesModule,
    ClientsModule,
    VideosModule,
    SchedulesModule,
    PlatformsModule,
    PublicationsModule,
    NotificationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
