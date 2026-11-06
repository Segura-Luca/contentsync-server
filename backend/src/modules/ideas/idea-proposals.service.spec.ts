/** Pruebas unitarias de las propuestas: quién puede verlas y responderlas, y aceptación sin duplicados. */
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { IdeaProposalStatus, NotificationType, RoleCode } from '@prisma/client';
import { IdeaProposalsService } from './idea-proposals.service';

describe('IdeaProposalsService (ideas propuestas por los clientes)', () => {
  const agencyUser: any = { sub: 'agency-user', role: RoleCode.AGENCIA, agencyId: 'a1' };
  const otherAgency: any = { sub: 'other', role: RoleCode.AGENCIA, agencyId: 'a2' };
  const clientUser: any = { sub: 'client-user', role: RoleCode.CLIENTE, clientId: 'c1' };

  const pending = {
    id: 'p1',
    agencyId: 'a1',
    clientId: 'c1',
    title: 'Idea',
    content: 'Desarrollo',
    referenceUrl: null,
    status: IdeaProposalStatus.PENDING,
    client: { id: 'c1', companyName: 'Kafecito', userId: 'client-user' },
  };

  let prisma: any;
  let notifications: any;
  let service: IdeaProposalsService;

  beforeEach(() => {
    prisma = {
      client: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'c1',
          agencyId: 'a1',
          companyName: 'Kafecito',
          agency: { ownerUserId: 'agency-user' },
        }),
      },
      clientIdeaProposal: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(pending),
        create: jest.fn(({ data }) => Promise.resolve({ id: 'p1', ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      contentIdeaSection: { findUnique: jest.fn().mockResolvedValue({ id: 's1', agencyId: 'a1' }) },
      contentIdea: { create: jest.fn(({ data }) => Promise.resolve({ id: 'i1', ...data })) },
      $transaction: jest.fn((run) => run(prisma)),
    };
    notifications = { notifyUser: jest.fn() };
    service = new IdeaProposalsService(prisma, notifications, { log: jest.fn() } as any);
  });

  it('el cliente propone a su propia agencia y la agencia recibe el aviso', async () => {
    await service.create({ title: ' Idea ', content: ' Algo ' }, clientUser);

    expect(prisma.clientIdeaProposal.create.mock.calls[0][0].data).toMatchObject({
      agencyId: 'a1',
      clientId: 'c1',
      title: 'Idea',
      content: 'Algo',
    });
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'agency-user', type: NotificationType.IDEA_PROPOSED }),
    );
  });

  it('no acepta una propuesta solo con espacios', async () => {
    await expect(service.create({ title: '   ', content: 'Algo' }, clientUser)).rejects.toThrow(BadRequestException);
  });

  it('cada cliente lista solo sus propuestas', async () => {
    await service.list(clientUser);
    expect(prisma.clientIdeaProposal.findMany.mock.calls[0][0].where).toMatchObject({ clientId: 'c1' });
  });

  it('aceptar sin cambios crea la idea con lo que propuso el cliente', async () => {
    const idea = await service.accept('p1', { sectionId: 's1' }, agencyUser);

    expect(idea).toMatchObject({ title: 'Idea', content: 'Desarrollo', clientId: 'c1', createdByUserId: 'agency-user' });
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'client-user', type: NotificationType.IDEA_ACCEPTED }),
    );
  });

  it('editar y aceptar guarda los cambios de la agencia', async () => {
    const idea = await service.accept('p1', { sectionId: 's1', title: 'Mejor título' }, agencyUser);
    expect(idea.title).toBe('Mejor título');
  });

  it('no deja guardar en una sección de otra agencia', async () => {
    prisma.contentIdeaSection.findUnique.mockResolvedValue({ id: 's9', agencyId: 'a2' });
    await expect(service.accept('p1', { sectionId: 's9' }, agencyUser)).rejects.toThrow(BadRequestException);
    expect(prisma.contentIdea.create).not.toHaveBeenCalled();
  });

  it('otra agencia no puede responderla', async () => {
    await expect(service.reject('p1', otherAgency)).rejects.toThrow(ForbiddenException);
  });

  it('una propuesta ya respondida no se responde de nuevo', async () => {
    prisma.clientIdeaProposal.findUnique.mockResolvedValue({ ...pending, status: IdeaProposalStatus.REJECTED });
    await expect(service.accept('p1', { sectionId: 's1' }, agencyUser)).rejects.toThrow(ConflictException);
  });

  it('si dos aceptan a la vez, la idea se crea una sola vez', async () => {
    prisma.clientIdeaProposal.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.accept('p1', { sectionId: 's1' }, agencyUser)).rejects.toThrow(ConflictException);
    expect(prisma.contentIdea.create).not.toHaveBeenCalled();
  });

  it('rechazar avisa al cliente y no crea ninguna idea', async () => {
    await service.reject('p1', agencyUser);

    expect(prisma.contentIdea.create).not.toHaveBeenCalled();
    expect(notifications.notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'client-user', type: NotificationType.IDEA_REJECTED }),
    );
  });
});
