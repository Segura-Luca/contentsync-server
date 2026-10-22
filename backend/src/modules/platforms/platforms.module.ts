import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { ClientsModule } from '../clients/clients.module';
import { PlatformsController } from './platforms.controller';
import { PlatformsService } from './platforms.service';
import { InstagramReelsPublisher } from './publishers/instagram-reels.publisher';
import { TikTokVideoPublisher } from './publishers/tiktok-video.publisher';
import { YouTubeShortsPublisher } from './publishers/youtube-shorts.publisher';

@Module({
  imports: [ClientsModule],
  controllers: [PlatformsController],
  providers: [
    PlatformsService,
    InstagramReelsPublisher,
    TikTokVideoPublisher,
    YouTubeShortsPublisher,
    CryptoService,
    AuditService,
  ],
  exports: [PlatformsService],
})
export class PlatformsModule {}
