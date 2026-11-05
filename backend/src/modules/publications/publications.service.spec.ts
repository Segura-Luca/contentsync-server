import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import {
  PublicationStatus,
  RoleCode,
  SocialPlatform,
  VideoWorkflowStatus,
} from '@prisma/client';
import { NonRetryablePublishError } from '../platforms/publishers/platform-publisher.interface';
import { cloneDefaultSettings } from '../settings/settings.defaults';
import { PublicationsService } from './publications.service';

/** La publicación inmediata corre en segundo plano: se espera a que termine antes de comprobarla. */
async function waitForCalls(mock: jest.Mock, times: number) {
  for (let i = 0; i < 500 && mock.mock.calls.length < times; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe('PublicationsService (Phase 6 & 7 Multi-Platform Publishing, Retries & History)', () => {
  const mockPrisma: any = {
    publication: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
    getPublishUrl: jest.fn((key: string) => `https://s3.local/${key}`),
  };

  const mockNotifications: any = {
    notifyUser: jest.fn(),
  };

  const mockAudit: any = {
    log: jest.fn(),
  };

  const settings: any = {
    current: () => ({ ...cloneDefaultSettings(), publishRetryDelaySeconds: 0 }),
  };
  const mockConfig: any = { schedulerEnabled: false, publishStaleMinutes: 15 };

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
      settings,
      mockConfig,
    );
    mockPrisma.publication.updateMany.mockResolvedValue({ count: 1 });
    mockPublisher.publishVideo.mockClear();
  });

  it('should keep an IN_REVIEW video waiting for approval without publishing it', async () => {
    mockVideos.findOneWithAccess.mockResolvedValueOnce({
      id: 'video-review',
      clientId: 'client-1',
      workflowStatus: VideoWorkflowStatus.IN_REVIEW,
      platformTargets: [{ platform: SocialPlatform.INSTAGRAM }],
      publications: [],
    });
    mockPrisma.publication.upsert.mockResolvedValueOnce({ id: 'pub-1' });

    const res: any = await service.scheduleOrPublishMultiPlatform(
      { videoId: 'video-review' },
      { sub: 'agency-user-1', email: 'a@n.com', role: RoleCode.AGENCIA, agencyId: 'agency-1' },
    );

    expect(res.mode).toBe('AWAITING_APPROVAL');
    expect(mockPublisher.publishVideo).not.toHaveBeenCalled();
    expect(mockPrisma.video.update).not.toHaveBeenCalled();
  });

  it('should block publishing if the video is still a draft', async () => {
    mockVideos.findOneWithAccess.mockResolvedValueOnce({
      id: 'video-unapproved',
      clientId: 'client-1',
      workflowStatus: VideoWorkflowStatus.DRAFT,
      platformTargets: [{ platform: SocialPlatform.INSTAGRAM }],
      publications: [],
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
      clientId: 'client-1',
      workflowStatus: VideoWorkflowStatus.APPROVED,
      publications: [],
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
    expect((res as any).publications).toHaveLength(3);
    await waitForCalls(mockPrisma.publicationAttempt.create, 3);
    expect(mockPrisma.publicationAttempt.create).toHaveBeenCalledTimes(3);
    expect(mockNotifications.notifyUser).toHaveBeenCalled();
  });

  const pubRow = (overrides: object = {}) => ({
    id: 'pub-1',
    videoId: 'v-1',
    platform: SocialPlatform.INSTAGRAM,
    status: PublicationStatus.FAILED,
    attempts: [],
    video: {
      id: 'v-1',
      clientId: 'client-1',
      uploadedByUserId: 'u-1',
      title: 'T',
      description: 'D',
      storageKey: 'k.mp4',
      workflowStatus: VideoWorkflowStatus.APPROVED,
      hashtags: [],
      platformTargets: [],
    },
    ...overrides,
  });
  const agency = { sub: 'u-1', email: 'a@n.com', role: RoleCode.AGENCIA, agencyId: 'a-1' };

  it('should not re-upload to a platform where the video is already published', async () => {
    mockVideos.findOneWithAccess.mockResolvedValueOnce({
      id: 'v-1',
      clientId: 'client-1',
      workflowStatus: VideoWorkflowStatus.SCHEDULED,
      platformTargets: [{ platform: SocialPlatform.INSTAGRAM }],
      publications: [{ platform: SocialPlatform.INSTAGRAM, status: PublicationStatus.PUBLISHED }],
    });
    await expect(service.scheduleOrPublishMultiPlatform({ videoId: 'v-1' }, agency)).rejects.toThrow(
      BadRequestException,
    );
    expect(mockPrisma.publication.upsert).not.toHaveBeenCalled();
  });

  it('should skip a publication another process already claimed', async () => {
    mockPrisma.publication.findUnique.mockResolvedValueOnce(pubRow({ status: PublicationStatus.PROCESSING }));
    mockPrisma.publication.updateMany.mockResolvedValueOnce({ count: 0 });

    await service.executeSinglePlatformPublicationWithRetries('pub-1');

    expect(mockPublisher.publishVideo).not.toHaveBeenCalled();
  });

  it('should stop retrying on a definitive error', async () => {
    mockPrisma.publication.findUnique.mockResolvedValueOnce(pubRow());
    mockPlatforms.getValidDecryptedCredentials.mockRejectedValueOnce(new NonRetryablePublishError('sin cuenta'));
    mockPrisma.publication.update.mockResolvedValueOnce({ status: PublicationStatus.FAILED });

    await service.executeSinglePlatformPublicationWithRetries('pub-1');

    expect(mockPrisma.publicationAttempt.create).toHaveBeenCalledTimes(1);
  });

  describe('retryPublication', () => {
    it('should enforce tenant access', async () => {
      mockPrisma.publication.findUnique.mockResolvedValueOnce(pubRow());
      mockClients.assertClientAccess.mockRejectedValueOnce(new ForbiddenException());
      await expect(service.retryPublication('pub-1', agency)).rejects.toThrow(ForbiddenException);
      expect(mockPublisher.publishVideo).not.toHaveBeenCalled();
    });

    it('should refuse to publish again', async () => {
      mockPrisma.publication.findUnique.mockResolvedValueOnce(pubRow({ status: PublicationStatus.PUBLISHED }));
      await expect(service.retryPublication('pub-1', agency)).rejects.toThrow(ConflictException);
    });

    it('should grant a fresh batch of attempts after exhausting the automatic ones', async () => {
      const attempts = [1, 2, 3].map((attemptNumber) => ({ attemptNumber }));
      const row = pubRow({ attempts });
      mockPrisma.publication.findUnique.mockResolvedValue(row);
      mockPrisma.publication.update.mockResolvedValue({ status: PublicationStatus.PUBLISHED });
      mockPrisma.publication.findMany.mockResolvedValue([{ status: PublicationStatus.PUBLISHED }]);

      const res = await service.retryPublication('pub-1', agency);
      expect(res.status).toBe(PublicationStatus.PROCESSING);

      await waitForCalls(mockPrisma.publicationAttempt.create, 1);
      expect(mockPublisher.publishVideo).toHaveBeenCalledTimes(1);
      expect(mockPrisma.publicationAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ attemptNumber: 4, isSuccess: true }),
      });
    });
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
