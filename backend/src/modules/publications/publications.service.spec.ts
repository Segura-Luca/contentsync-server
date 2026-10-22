import { BadRequestException } from '@nestjs/common';
import {
  PublicationStatus,
  RoleCode,
  SocialPlatform,
  VideoWorkflowStatus,
} from '@prisma/client';
import { PublicationsService } from './publications.service';

describe('PublicationsService (Phase 6 & 7 Multi-Platform Publishing, Retries & History)', () => {
  const mockPrisma: any = {
    publication: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    publicationAttempt: {
      create: jest.fn(),
    },
    video: {
      update: jest.fn(),
    },
  };

  const mockVideos: any = {
    findOneWithAccess: jest.fn(),
  };

  const mockClients: any = {
    assertClientAccess: jest.fn(),
  };

  const mockPublisher = {
    platform: SocialPlatform.INSTAGRAM,
    publishVideo: jest.fn().mockResolvedValue({
      platform: SocialPlatform.INSTAGRAM,
      externalPostId: 'ig_reel_123',
      externalPostUrl: 'https://www.instagram.com/reel/ig_reel_123/',
      publishedAt: new Date(),
    }),
  };

  const mockPlatforms: any = {
    getPublisher: jest.fn().mockReturnValue(mockPublisher),
    getValidDecryptedCredentials: jest.fn().mockResolvedValue({
      accessToken: 'decrypted_access_token',
      externalAccountId: 'ig_acc_1',
    }),
  };

  const mockStorage: any = {
    getPublicUrl: jest.fn((key: string) => `https://s3.local/${key}`),
  };

  const mockNotifications: any = {
    notifyUser: jest.fn(),
  };

  const mockAudit: any = {
    log: jest.fn(),
  };

  let service: PublicationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PublicationsService(
      mockPrisma,
      mockVideos,
      mockClients,
      mockPlatforms,
      mockStorage,
      mockNotifications,
      mockAudit,
    );
  });

  it('should block publishing if the video has NOT been approved by the client', async () => {
    mockVideos.findOneWithAccess.mockResolvedValueOnce({
      id: 'video-unapproved',
      workflowStatus: VideoWorkflowStatus.IN_REVIEW,
      platformTargets: [{ platform: SocialPlatform.INSTAGRAM }],
    });

    await expect(
      service.scheduleOrPublishMultiPlatform(
        { videoId: 'video-unapproved' },
        {
          sub: 'agency-user-1',
          email: 'agencia@nova.com',
          role: RoleCode.AGENCIA,
          agencyId: 'agency-1',
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should publish an APPROVED video across all target platforms and log attempts', async () => {
    mockVideos.findOneWithAccess.mockResolvedValueOnce({
      id: 'video-approved',
      title: 'Cold Brew Reel',
      description: 'Descripción',
      storageKey: 'kafecito/reel.mp4',
      workflowStatus: VideoWorkflowStatus.APPROVED,
      platformTargets: [
        { platform: SocialPlatform.INSTAGRAM },
        { platform: SocialPlatform.TIKTOK },
        { platform: SocialPlatform.YOUTUBE },
      ],
    });

    mockPrisma.publication.upsert.mockImplementation(async ({ create }: any) => ({
      id: `pub_${create.platform}`,
      videoId: create.videoId,
      platform: create.platform,
    }));

    mockPrisma.publication.findUnique.mockImplementation(async ({ where }: any) => ({
      id: where.id,
      videoId: 'video-approved',
      platform: SocialPlatform.INSTAGRAM,
      attempts: [],
      video: {
        id: 'video-approved',
        clientId: 'client-1',
        uploadedByUserId: 'agency-user-1',
        title: 'Cold Brew Reel',
        description: 'Descripción',
        storageKey: 'kafecito/reel.mp4',
        hashtags: [{ tag: 'cafe' }],
        platformTargets: [{ platform: SocialPlatform.INSTAGRAM }],
      },
    }));

    mockPrisma.publication.update.mockImplementation(async ({ data }: any) => ({
      status: data.status,
      externalPostId: data.externalPostId,
      externalPostUrl: data.externalPostUrl,
    }));

    mockPrisma.publication.findMany.mockResolvedValue([
      { status: PublicationStatus.PUBLISHED },
    ]);

    const res = await service.scheduleOrPublishMultiPlatform(
      { videoId: 'video-approved' },
      {
        sub: 'agency-user-1',
        email: 'agencia@nova.com',
        role: RoleCode.AGENCIA,
        agencyId: 'agency-1',
      },
    );

    expect(res.mode).toBe('IMMEDIATE');
    expect(res.publications).toHaveLength(3);
    expect(mockPrisma.publicationAttempt.create).toHaveBeenCalledTimes(3);
    expect(mockNotifications.notifyUser).toHaveBeenCalled();
  });

  it('should filter publication history by client, platform, status, and search query', async () => {
    mockPrisma.publication.findMany.mockResolvedValueOnce([]);

    await service.getPublicationHistory(
      {
        platform: SocialPlatform.YOUTUBE,
        status: PublicationStatus.PUBLISHED,
        search: 'Cold Brew',
      },
      {
        sub: 'agency-user-1',
        email: 'agencia@nova.com',
        role: RoleCode.AGENCIA,
        agencyId: 'agency-1',
      },
    );

    expect(mockPrisma.publication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          platform: SocialPlatform.YOUTUBE,
          status: PublicationStatus.PUBLISHED,
        }),
      }),
    );
  });
});
