import { BadRequestException } from '@nestjs/common';
import { SocialPlatform } from '@prisma/client';
import { VideosService } from './videos.service';

describe('VideosService (Phase 4 Video Specs & Presigned Upload Validation)', () => {
  const mockPrisma: any = {};
  const mockClients: any = { assertClientAccess: jest.fn() };
  const mockStorage: any = {
    createPresignedUploadUrl: jest.fn().mockResolvedValue({
      uploadUrl: 'https://s3.local/upload',
      publicUrl: 'https://s3.local/public.mp4',
      storageKey: 'clients/c1/video.mp4',
      expiresInSeconds: 3600,
    }),
  };
  const mockAudit: any = { log: jest.fn() };

  let service: VideosService;

  beforeEach(() => {
    service = new VideosService(mockPrisma, mockClients, mockStorage, mockAudit);
  });

  it('should accept a 45s MP4 video targeting Instagram, TikTok, and YouTube Shorts', () => {
    expect(() =>
      service.validateVideoSpecsForPlatforms({
        mimeType: 'video/mp4',
        durationSeconds: 45,
        sizeBytes: 25 * 1024 * 1024,
        platforms: [
          SocialPlatform.INSTAGRAM,
          SocialPlatform.TIKTOK,
          SocialPlatform.YOUTUBE,
        ],
      }),
    ).not.toThrow();
  });

  it('should reject a 240s video when YouTube Shorts (max 180s) is among target platforms', () => {
    expect(() =>
      service.validateVideoSpecsForPlatforms({
        mimeType: 'video/mp4',
        durationSeconds: 240,
        sizeBytes: 30 * 1024 * 1024,
        platforms: [SocialPlatform.INSTAGRAM, SocialPlatform.YOUTUBE],
      }),
    ).toThrow(BadRequestException);
  });

  it('should reject unsupported MIME type for Instagram Reels', () => {
    expect(() =>
      service.validateVideoSpecsForPlatforms({
        mimeType: 'video/webm',
        durationSeconds: 30,
        sizeBytes: 10 * 1024 * 1024,
        platforms: [SocialPlatform.INSTAGRAM],
      }),
    ).toThrow(BadRequestException);
  });
});
