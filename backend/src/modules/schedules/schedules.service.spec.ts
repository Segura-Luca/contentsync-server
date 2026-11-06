import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  ApprovalDecision,
  BlockReviewStatus,
  ContentType,
  MediaKind,
  NotificationType,
  ProductionStatus,
  RoleCode,
  ScheduleStatus,
} from '@prisma/client';
import { SchedulesService } from './schedules.service';

describe('SchedulesService (cronogramas, revisión y confirmación)', () => {
  const tx: any = {
    scheduleItemMedia: { deleteMany: jest.fn(), createMany: jest.fn() },
    schedule: { update: jest.fn() },
    scheduleItem: { update: jest.fn(async ({ data }: any) => ({ id: 'b1', blockTitle: 'Título', media: [], ...data })) },
  };
  const mockPrisma: any = {
    schedule: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    scheduleItem: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    blockReview: { create: jest.fn(), createMany: jest.fn() },
    blockComment: { create: jest.fn() },
    $transaction: jest.fn(async (ops: any) => (typeof ops === 'function' ? ops(tx) : Promise.all(ops))),
  };
  const mockClients: any = { assertClientAccess: jest.fn().mockResolvedValue({ userId: 'client-user' }) };
  const mockNotifications: any = { notifyUser: jest.fn() };
  const mockAudit: any = { log: jest.fn() };
  const mockStorage: any = {
    getMediaUrl: jest.fn(async (key: string) => `https://firmado.test/${key}`),
    isValidStorageKey: jest.fn((key: string, clientId: string) => key.startsWith(`clients/${clientId}/`)),
    deleteIfUnused: jest.fn(),
  };

  const clientUser = { sub: 'client-user', role: RoleCode.CLIENTE, clientId: 'c1' } as any;
  const agencyUser = { sub: 'agency-user', role: RoleCode.AGENCIA, agencyId: 'a1' } as any;
  const schedule = {
    id: 's1',
    clientId: 'c1',
    title: 'Semana',
    status: ScheduleStatus.IN_REVIEW,
    client: { userId: 'client-user', companyName: 'Marca', agency: { ownerUserId: 'agency-user' } },
  };
  const block = (overrides: any = {}) => ({
    id: 'b1',
    dayOfWeek: 1,
    contentType: ContentType.REEL,
    blockTitle: 'Título',
    noteColor: 'AMBER',
    notes: null,
    caption: null,
    plannedTime: '18:00',
    reviewStatus: BlockReviewStatus.IN_REVIEW,
    media: [],
    schedule,
    ...overrides,
  });

  let service: SchedulesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SchedulesService(mockPrisma, mockClients, mockNotifications, mockAudit, mockStorage);
  });

  describe('crear bloques', () => {
    const dto = { dayOfWeek: 1, contentType: ContentType.CAROUSEL, blockTitle: ' Carrusel ' };

    beforeEach(() => {
      mockPrisma.schedule.findUnique.mockResolvedValue(schedule);
      mockPrisma.scheduleItem.create.mockImplementation(async ({ data }: any) => ({
        id: 'b1',
        blockTitle: data.blockTitle,
        media: data.media.create.map((row: any) => ({ ...row })),
      }));
    });

    it('guarda cada foto o video con su descripción y orden, y devuelve el enlace para verlo', async () => {
      const created: any = await service.createBlock(
        's1',
        {
          ...dto,
          media: [
            { storageKey: 'clients/c1/a.jpg', description: ' Portada ' },
            { storageKey: 'clients/c1/b.mp4', description: 'Segundo' },
          ],
        },
        agencyUser,
      );

      expect(mockPrisma.scheduleItem.create.mock.calls[0][0].data).toMatchObject({
        contentType: ContentType.CAROUSEL,
        blockTitle: 'Carrusel',
        media: {
          create: [
            { kind: MediaKind.IMAGE, mimeType: 'image/jpeg', description: 'Portada', position: 0 },
            { kind: MediaKind.VIDEO, mimeType: 'video/mp4', description: 'Segundo', position: 1 },
          ],
        },
      });
      expect(created.media[0].url).toBe('https://firmado.test/clients/c1/a.jpg');
    });

    it('rechaza un archivo de otro cliente', async () => {
      await expect(
        service.createBlock('s1', { ...dto, media: [{ storageKey: 'clients/otro/a.jpg' }] }, agencyUser),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.scheduleItem.create).not.toHaveBeenCalled();
    });

    it('rechaza un formato que no se puede mostrar', async () => {
      await expect(
        service.createBlock('s1', { ...dto, media: [{ storageKey: 'clients/c1/a.exe' }] }, agencyUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('un bloque nuevo sobre una semana confirmada vuelve a pedir confirmación', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue({ ...schedule, status: ScheduleStatus.APPROVED });
      await service.createBlock('s1', dto, agencyUser);
      expect(mockPrisma.schedule.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: ScheduleStatus.IN_REVIEW, confirmedAt: null, confirmedByUserId: null },
      });
    });

    it('el cliente no puede agregar bloques', async () => {
      await expect(service.createBlock('s1', dto, clientUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('editar bloques', () => {
    it('si cambia el contenido, vuelve a revisión y avisa al cliente', async () => {
      mockPrisma.scheduleItem.findUnique.mockResolvedValue(block({ reviewStatus: BlockReviewStatus.APPROVED }));

      await service.updateBlock('b1', { notes: 'Otro texto' }, agencyUser);

      expect(tx.scheduleItem.update.mock.calls[0][0].data.reviewStatus).toBe(BlockReviewStatus.IN_REVIEW);
      expect(mockNotifications.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'client-user', type: NotificationType.BLOCK_IN_REVIEW }),
      );
    });

    it('cambiar solo el color no pide otra revisión', async () => {
      mockPrisma.scheduleItem.findUnique.mockResolvedValue(block({ reviewStatus: BlockReviewStatus.APPROVED }));

      await service.updateBlock('b1', { noteColor: 'rose' }, agencyUser);

      expect(tx.scheduleItem.update.mock.calls[0][0].data.reviewStatus).toBeUndefined();
      expect(tx.scheduleItem.update.mock.calls[0][0].data.noteColor).toBe('ROSE');
      expect(mockNotifications.notifyUser).not.toHaveBeenCalled();
    });

    it('cambiar el estado de producción no pide otra revisión', async () => {
      mockPrisma.scheduleItem.findUnique.mockResolvedValue(
        block({ reviewStatus: BlockReviewStatus.APPROVED, productionStatus: ProductionStatus.PENDING }),
      );

      await service.updateBlock('b1', { productionStatus: ProductionStatus.RECORDED }, agencyUser);

      const data = tx.scheduleItem.update.mock.calls[0][0].data;
      expect(data.productionStatus).toBe(ProductionStatus.RECORDED);
      expect(data.reviewStatus).toBeUndefined();
      expect(mockNotifications.notifyUser).not.toHaveBeenCalled();
    });

    it('cambiar algo de una semana confirmada la vuelve a abrir', async () => {
      mockPrisma.scheduleItem.findUnique.mockResolvedValue(
        block({ schedule: { ...schedule, status: ScheduleStatus.APPROVED } }),
      );

      await service.updateBlock('b1', { plannedTime: '20:00' }, agencyUser);

      expect(tx.schedule.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: ScheduleStatus.IN_REVIEW, confirmedAt: null, confirmedByUserId: null },
      });
    });

    it('borra solo los archivos que se quitaron del bloque', async () => {
      mockPrisma.scheduleItem.findUnique.mockResolvedValue(
        block({
          media: [
            { storageKey: 'clients/c1/queda.jpg', description: null },
            { storageKey: 'clients/c1/sale.jpg', description: null },
          ],
        }),
      );

      await service.updateBlock('b1', { media: [{ storageKey: 'clients/c1/queda.jpg' }] }, agencyUser);

      expect(mockStorage.deleteIfUnused).toHaveBeenCalledWith(['clients/c1/sale.jpg']);
    });

    it('cambiar la descripción de una foto también vuelve a revisión', async () => {
      mockPrisma.scheduleItem.findUnique.mockResolvedValue(
        block({
          reviewStatus: BlockReviewStatus.APPROVED,
          media: [{ storageKey: 'clients/c1/a.jpg', description: 'Vieja' }],
        }),
      );

      await service.updateBlock('b1', { media: [{ storageKey: 'clients/c1/a.jpg', description: 'Nueva' }] }, agencyUser);

      expect(tx.scheduleItem.update.mock.calls[0][0].data.reviewStatus).toBe(BlockReviewStatus.IN_REVIEW);
    });
  });

  describe('revisión del cliente', () => {
    beforeEach(() => mockPrisma.scheduleItem.findUnique.mockResolvedValue(block()));

    it('exige un comentario al pedir cambios o rechazar', async () => {
      await expect(
        service.reviewBlock('b1', { decision: ApprovalDecision.CHANGES_REQUESTED, feedbackNotes: ' ' }, clientUser),
      ).rejects.toThrow(BadRequestException);
      await expect(service.reviewBlock('b1', { decision: ApprovalDecision.REJECTED }, clientUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('después de pedir cambios se puede rechazar sin escribir otro motivo', async () => {
      mockPrisma.scheduleItem.findUnique.mockResolvedValue(block({ reviewStatus: BlockReviewStatus.CHANGES_REQUESTED }));

      const res = await service.reviewBlock('b1', { decision: ApprovalDecision.REJECTED }, clientUser);

      expect(res.reviewStatus).toBe(BlockReviewStatus.REJECTED);
      expect(mockPrisma.blockComment.create).not.toHaveBeenCalled();
    });

    it('aprobar actualiza el bloque y avisa a la agencia', async () => {
      const res = await service.reviewBlock('b1', { decision: ApprovalDecision.APPROVED }, clientUser);

      expect(res.reviewStatus).toBe(BlockReviewStatus.APPROVED);
      expect(mockNotifications.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'agency-user', type: NotificationType.BLOCK_APPROVED }),
      );
    });

    it('el pedido de cambios queda también como comentario', async () => {
      await service.reviewBlock('b1', { decision: ApprovalDecision.CHANGES_REQUESTED, feedbackNotes: 'Otra portada' }, clientUser);

      expect(mockPrisma.blockComment.create).toHaveBeenCalledWith({
        data: { scheduleItemId: 'b1', authorUserId: 'client-user', message: 'Otra portada' },
      });
    });

    it('pedir cambios sobre una semana confirmada la vuelve a abrir', async () => {
      mockPrisma.scheduleItem.findUnique.mockResolvedValue(
        block({ schedule: { ...schedule, status: ScheduleStatus.APPROVED } }),
      );

      await service.reviewBlock('b1', { decision: ApprovalDecision.CHANGES_REQUESTED, feedbackNotes: 'Cambiar' }, clientUser);

      expect(mockPrisma.schedule.update).toHaveBeenCalled();
    });

    it('la agencia no puede aprobar su propio contenido', async () => {
      await expect(service.reviewBlock('b1', { decision: ApprovalDecision.APPROVED }, agencyUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('confirmar el cronograma', () => {
    const withItems = (items: any[], status: ScheduleStatus = ScheduleStatus.IN_REVIEW) => ({ ...schedule, status, items });

    it('aprueba lo que estaba en revisión y avisa a la agencia', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue(
        withItems([
          { id: 'b1', reviewStatus: BlockReviewStatus.APPROVED },
          { id: 'b2', reviewStatus: BlockReviewStatus.IN_REVIEW },
        ]),
      );

      const res = await service.confirmSchedule('s1', clientUser);

      expect(res.status).toBe(ScheduleStatus.APPROVED);
      expect(mockPrisma.scheduleItem.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['b2'] } },
        data: { reviewStatus: BlockReviewStatus.APPROVED },
      });
      expect(mockPrisma.schedule.update.mock.calls[0][0].data).toMatchObject({
        status: ScheduleStatus.APPROVED,
        confirmedByUserId: 'client-user',
      });
      expect(mockNotifications.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'agency-user', type: NotificationType.SCHEDULE_CONFIRMED }),
      );
    });

    it('no se puede confirmar con cambios pendientes', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue(
        withItems([{ id: 'b1', reviewStatus: BlockReviewStatus.CHANGES_REQUESTED }]),
      );
      await expect(service.confirmSchedule('s1', clientUser)).rejects.toThrow('cambios pendientes');
    });

    it('no se puede confirmar un cronograma vacío', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue(withItems([]));
      await expect(service.confirmSchedule('s1', clientUser)).rejects.toThrow('todavía no tiene contenido');
    });

    it('confirmar dos veces no repite el aviso', async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue(withItems([], ScheduleStatus.APPROVED));
      await service.confirmSchedule('s1', clientUser);
      expect(mockNotifications.notifyUser).not.toHaveBeenCalled();
    });

    it('la agencia no puede confirmar por el cliente', async () => {
      await expect(service.confirmSchedule('s1', agencyUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('comentarios', () => {
    beforeEach(() => {
      mockPrisma.scheduleItem.findUnique.mockResolvedValue(block());
      mockPrisma.blockComment.create.mockResolvedValue({ id: 'c', authorUser: { fullName: 'Ana' } });
    });

    it('el comentario del cliente avisa a la agencia', async () => {
      await service.addComment('b1', { message: 'Hola' }, clientUser);
      expect(mockNotifications.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'agency-user', type: NotificationType.BLOCK_COMMENT }),
      );
    });

    it('el comentario de la agencia avisa al cliente', async () => {
      await service.addComment('b1', { message: 'Hola' }, agencyUser);
      expect(mockNotifications.notifyUser).toHaveBeenCalledWith(expect.objectContaining({ userId: 'client-user' }));
    });
  });

  it('exige que la semana comience un lunes', async () => {
    await expect(
      service.createSchedule(
        { clientId: 'c1', weekStartDate: '2026-11-03', weekEndDate: '2026-11-07', title: 'x' },
        agencyUser,
      ),
    ).rejects.toThrow('lunes');
  });
});
