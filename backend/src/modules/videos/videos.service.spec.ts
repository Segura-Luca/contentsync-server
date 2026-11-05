import { BadRequestException } from '@nestjs/common';
import { RoleCode, SocialPlatform, VideoWorkflowStatus } from '@prisma/client';
import { StorageService } from '../storage/storage.service';
import { cloneDefaultSettings } from '../settings/settings.defaults';
import { VideosService } from './videos.service';

describe('VideosService (validación de formatos y límites configurables)', () => {
  const mockPrisma: any = { video: { create: jest.fn(async ({ data }: any) => ({ id: 'v-1', ...data })) } };
  const mockClients: any = { assertClientAccess: jest.fn() };
  const mockAudit: any = { log: jest.fn() };
  const storage = new StorageService({
    get: () => undefined,
    publicBaseUrl: () => 'https://app.test',
  } as any);
  let currentSettings = cloneDefaultSettings();
  const settings: any = { current: () => currentSettings };
  const agency = { sub: 'u-1', email: 'a@b.com', role: RoleCode.AGENCIA, agencyId: 'a-1' };

  const baseDto = {
    clientId: 'client-1',
    title: 'Título',
    description: 'Descripción',
    storageKey: '/uploads/videos/1_abc.mp4',
    durationSeconds: 30,
    sizeBytes: 1024,
    mimeType: 'video/mp4',
    hashtags: [],
    platformTargets: [{ platform: SocialPlatform.YOUTUBE }],
  };

  let service: VideosService;

  beforeEach(() => {
    jest.clearAllMocks();
    currentSettings = cloneDefaultSettings();
    service = new VideosService(mockPrisma, mockClients, storage, mockAudit, settings);
  });

  it('acepta un MP4 de 45s en las tres redes', () => {
    expect(() =>
      service.validateVideoSpecsForPlatforms({
        mimeType: 'video/mp4',
        durationSeconds: 45,
        sizeBytes: 25 * 1024 * 1024,
        platforms: [SocialPlatform.INSTAGRAM, SocialPlatform.TIKTOK, SocialPlatform.YOUTUBE],
      }),
    ).not.toThrow();
  });

  it('aplica los límites por defecto de la especificación (Shorts 60s, Reels 90s, TikTok 600s)', () => {
    const check = (platform: SocialPlatform, durationSeconds: number) => () =>
      service.validateVideoSpecsForPlatforms({
        mimeType: 'video/mp4',
        durationSeconds,
        sizeBytes: 1024,
        platforms: [platform],
      });
    expect(check(SocialPlatform.YOUTUBE, 60)).not.toThrow();
    expect(check(SocialPlatform.YOUTUBE, 61)).toThrow(BadRequestException);
    expect(check(SocialPlatform.INSTAGRAM, 91)).toThrow(BadRequestException);
    expect(check(SocialPlatform.TIKTOK, 601)).toThrow(BadRequestException);
  });

  it('respeta los límites editados en Ajustes', () => {
    currentSettings.platformLimits.YOUTUBE.maxDurationSeconds = 180;
    expect(() =>
      service.validateVideoSpecsForPlatforms({
        mimeType: 'video/mp4',
        durationSeconds: 170,
        sizeBytes: 1024,
        platforms: [SocialPlatform.YOUTUBE],
      }),
    ).not.toThrow();
  });

  it('rechaza un formato no admitido por Instagram', () => {
    expect(() =>
      service.validateVideoSpecsForPlatforms({
        mimeType: 'video/webm',
        durationSeconds: 30,
        sizeBytes: 1024,
        platforms: [SocialPlatform.INSTAGRAM],
      }),
    ).toThrow(BadRequestException);
  });

  it.each(['http://169.254.169.254/latest/meta-data', '/uploads/videos/../../.env', 'clients/otro-cliente/a.mp4'])(
    'rechaza la referencia de archivo %s',
    async (storageKey) => {
      await expect(service.create({ ...baseDto, storageKey } as any, agency)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.video.create).not.toHaveBeenCalled();
    },
  );

  it('el modo directo pasa por revisión mientras se exija aprobación del cliente', async () => {
    const pendingReview = await service.create({ ...baseDto, publishMode: 'DIRECT' } as any, agency);
    expect(pendingReview.workflowStatus).toBe(VideoWorkflowStatus.IN_REVIEW);

    currentSettings.requireClientApproval = false;
    const direct = await service.create({ ...baseDto, publishMode: 'DIRECT' } as any, agency);
    expect(direct.workflowStatus).toBe(VideoWorkflowStatus.APPROVED);
  });

  it('no consulta sin filtro cuando la agencia no está definida', async () => {
    const videos = await service.findAllForUser({ ...agency, agencyId: null });
    expect(videos).toEqual([]);
  });
});
