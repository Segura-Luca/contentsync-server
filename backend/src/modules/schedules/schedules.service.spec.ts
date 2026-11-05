import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  ApprovalDecision,
  PublicationStatus,
  RoleCode,
  SocialPlatform,
  VideoWorkflowStatus,
} from '@prisma/client';
import { cloneDefaultSettings } from '../settings/settings.defaults';
import { SchedulesService } from './schedules.service';

describe('SchedulesService (plan semanal y visado del cliente)', () => {
  const mockPrisma: any = {
    approval: { create: jest.fn() },
    video: { update: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
    videoComment: { create: jest.fn() },
    schedule: { findUnique: jest.fn() },
    scheduleItem: { count: jest.fn().mockResolvedValue(0), create: jest.fn() },
    publication: { deleteMany: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
  };
  const mockClients: any = { assertClientAccess: jest.fn() };
  const mockVideos: any = { findOneWithAccess: jest.fn(), validateVideoSpecsForPlatforms: jest.fn() };
  const mockNotifications: any = { notifyUser: jest.fn() };
  const mockAudit: any = { log: jest.fn() };
  const mockStorage: any = { getPublicUrl: (key: string) => key, isValidStorageKey: () => true, probeDurationSeconds: async () => null };
  let currentSettings = cloneDefaultSettings();
  const settings: any = { current: () => currentSettings };

  const clientUser = { sub: 'client-user-1', email: 'c@k.com', role: RoleCode.CLIENTE, clientId: 'c-1' };
  const agencyUser = {
    sub: 'agency-user-1',
    email: 'a@n.com',
    role: RoleCode.AGENCIA,
    agencyId: 'a-1',
    timezone: 'America/Argentina/Buenos_Aires',
  };
  const inlineVideo = {
    storageKey: '/uploads/videos/a.mp4',
    title: 'Reel',
    description: 'Desc',
    hashtags: [],
    platforms: [SocialPlatform.INSTAGRAM],
  };

  let service: SchedulesService;

  const nextMonday = () => {
    const date = new Date(Date.now() + 7 * 86400000);
    date.setUTCDate(date.getUTCDate() + ((8 - date.getUTCDay()) % 7));
    date.setUTCHours(0, 0, 0, 0);
    return date;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    currentSettings = cloneDefaultSettings();
    mockPrisma.schedule.findUnique.mockResolvedValue({
      id: 's-1',
      clientId: 'c-1',
      title: 'Semana',
      weekStartDate: nextMonday(),
      client: { userId: 'client-user-1' },
    });
    mockPrisma.scheduleItem.create.mockResolvedValue({ id: 'b-1', video: null });
    mockPrisma.video.create.mockResolvedValue({ id: 'v-new' });
    mockPrisma.publication.findMany.mockResolvedValue([]);
    service = new SchedulesService(
      mockPrisma,
      mockClients,
      mockVideos,
      mockNotifications,
      mockAudit,
      mockStorage,
      settings,
    );
  });

  it('exige una nota al pedir cambios o rechazar', async () => {
    mockVideos.findOneWithAccess.mockResolvedValueOnce({
      id: 'v-1',
      title: 'Video',
      workflowStatus: VideoWorkflowStatus.IN_REVIEW,
      uploadedByUserId: 'agency-user-1',
    });
    await expect(
      service.reviewVideo('v-1', { decision: ApprovalDecision.CHANGES_REQUESTED, feedbackNotes: '' }, clientUser),
    ).rejects.toThrow(BadRequestException);
  });

  it('pasa a APROBADO y avisa a quien subió el video', async () => {
    mockVideos.findOneWithAccess.mockResolvedValueOnce({
      id: 'v-1',
      title: 'Receta',
      workflowStatus: VideoWorkflowStatus.IN_REVIEW,
      uploadedByUserId: 'agency-user-1',
    });
    mockPrisma.approval.create.mockResolvedValueOnce({ id: 'app-1' });
    mockPrisma.video.update.mockResolvedValueOnce({ id: 'v-1', workflowStatus: VideoWorkflowStatus.APPROVED });

    const result = await service.reviewVideo(
      'v-1',
      { decision: ApprovalDecision.APPROVED, feedbackNotes: 'OK' },
      clientUser,
    );

    expect(result.workflowStatus).toBe(VideoWorkflowStatus.APPROVED);
    expect(mockNotifications.notifyUser).toHaveBeenCalledWith(expect.objectContaining({ userId: 'agency-user-1' }));
  });

  it('impide que una agencia apruebe sus propios videos', async () => {
    await expect(
      service.reviewVideo('v-1', { decision: ApprovalDecision.APPROVED }, agencyUser),
    ).rejects.toThrow(ForbiddenException);
    expect(mockPrisma.video.update).not.toHaveBeenCalled();
  });

  it('un bloque con publicación automática espera la aprobación del cliente', async () => {
    await service.createBlock(
      's-1',
      { dayOfWeek: 1, blockTitle: 'Bloque', plannedTime: '18:00', autoPublish: true, inlineVideo },
      agencyUser,
    );
    expect(mockPrisma.video.create.mock.calls[0][0].data.workflowStatus).toBe(VideoWorkflowStatus.IN_REVIEW);
    expect(mockPrisma.publication.upsert).toHaveBeenCalledTimes(1);
  });

  it('sin exigencia de aprobación, el bloque queda programado', async () => {
    currentSettings.requireClientApproval = false;
    await service.createBlock(
      's-1',
      { dayOfWeek: 1, blockTitle: 'Bloque', plannedTime: '18:00', autoPublish: true, inlineVideo },
      agencyUser,
    );
    expect(mockPrisma.video.create.mock.calls[0][0].data.workflowStatus).toBe(VideoWorkflowStatus.SCHEDULED);
  });

  it('programa a la hora de la zona horaria del usuario, sin importar la del servidor', async () => {
    const monday = nextMonday();
    await service.createBlock(
      's-1',
      { dayOfWeek: 1, blockTitle: 'Bloque', plannedTime: '18:00', autoPublish: true, inlineVideo },
      agencyUser,
    );
    const scheduledFor: Date = mockPrisma.publication.upsert.mock.calls[0][0].create.scheduledFor;
    // 18:00 en Buenos Aires (UTC-3) son las 21:00 UTC.
    expect(scheduledFor.toISOString()).toBe(
      new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 21, 0)).toISOString(),
    );
  });

  it('interpreta la medianoche como 00:00, no como las 18:00', async () => {
    const monday = nextMonday();
    await service.createBlock(
      's-1',
      { dayOfWeek: 1, blockTitle: 'Bloque', plannedTime: '00:30', autoPublish: true, inlineVideo },
      agencyUser,
    );
    const scheduledFor: Date = mockPrisma.publication.upsert.mock.calls[0][0].create.scheduledFor;
    expect(scheduledFor.toISOString()).toBe(
      new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 3, 30)).toISOString(),
    );
  });

  it('no vuelve a programar en una red donde el video ya está publicado', async () => {
    mockPrisma.publication.findMany.mockResolvedValue([
      { platform: SocialPlatform.INSTAGRAM, status: PublicationStatus.PUBLISHED },
    ]);
    await service.createBlock(
      's-1',
      { dayOfWeek: 1, blockTitle: 'Bloque', plannedTime: '18:00', autoPublish: true, inlineVideo },
      agencyUser,
    );
    expect(mockPrisma.publication.upsert).not.toHaveBeenCalled();
  });

  it('rechaza programar un bloque en el pasado', async () => {
    mockPrisma.schedule.findUnique.mockResolvedValue({
      id: 's-1',
      clientId: 'c-1',
      title: 'Semana',
      weekStartDate: new Date('2020-01-06T00:00:00Z'),
      client: { userId: 'client-user-1' },
    });
    await expect(
      service.createBlock(
        's-1',
        { dayOfWeek: 1, blockTitle: 'Bloque', plannedTime: '18:00', autoPublish: true, inlineVideo },
        agencyUser,
      ),
    ).rejects.toThrow('ya pasaron');
  });

  it('exige que la semana comience un lunes', async () => {
    await expect(
      service.createSchedule(
        { clientId: 'c-1', weekStartDate: '2026-11-03', weekEndDate: '2026-11-07', title: 'Martes' },
        agencyUser,
      ),
    ).rejects.toThrow('lunes');
  });
});
