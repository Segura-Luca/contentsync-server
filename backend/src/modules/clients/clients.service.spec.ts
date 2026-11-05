import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ClientConfirmationStatus, RoleCode } from '@prisma/client';
import { cloneDefaultSettings } from '../settings/settings.defaults';
import { ClientsService } from './clients.service';

describe('ClientsService (aislamiento multi-tenant y "Sí, soy yo")', () => {
  const mockPrisma: any = {
    client: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    user: { update: jest.fn() },
    notification: { updateMany: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => ops),
  };
  const mockAudit: any = { log: jest.fn() };
  const mockNotifications: any = { notifyUser: jest.fn() };
  const mockMail: any = { send: jest.fn().mockResolvedValue(true) };
  const mockConfig: any = { apiUrl: (path: string) => `https://app.test/api/v1/${path}` };
  const settings: any = { current: () => cloneDefaultSettings() };
  const agencyUser = {
    sub: 'user-agency-1',
    email: 'agencia@nova.com',
    role: RoleCode.AGENCIA,
    agencyId: 'agency-nova',
    clientId: null,
  };

  let service: ClientsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClientsService(mockPrisma, mockAudit, mockNotifications, mockMail, mockConfig, settings);
  });

  it('filtra por agencia cuando consulta una AGENCIA', async () => {
    mockPrisma.client.findMany.mockResolvedValueOnce([{ id: 'client-1', agencyId: 'agency-nova' }]);
    await service.findAllForUser(agencyUser);
    expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, agencyId: 'agency-nova' } }),
    );
  });

  it('nunca entrega el token de confirmación a la agencia', async () => {
    const pending = { id: 'c-1', agencyId: 'agency-nova', confirmationToken: 'secreto-del-correo' };
    mockPrisma.client.findMany.mockResolvedValueOnce([pending]);
    mockPrisma.client.findFirst.mockResolvedValueOnce(pending);

    const [listed] = await service.findAllForUser(agencyUser);
    const single = await service.assertClientAccess('c-1', agencyUser);

    expect(listed).not.toHaveProperty('confirmationToken');
    expect(single).not.toHaveProperty('confirmationToken');
  });

  it('bloquea a una AGENCIA sobre clientes de otra agencia', async () => {
    mockPrisma.client.findFirst.mockResolvedValueOnce({ id: 'client-other', agencyId: 'agency-pulso' });
    await expect(service.assertClientAccess('client-other', agencyUser)).rejects.toThrow(ForbiddenException);
  });

  it('bloquea a un CLIENTE sobre recursos de otro cliente', async () => {
    mockPrisma.client.findFirst.mockResolvedValueOnce({ id: 'client-other', agencyId: 'agency-nova' });
    await expect(
      service.assertClientAccess('client-other', {
        sub: 'user-client-1',
        email: 'cliente@kafecito.com',
        role: RoleCode.CLIENTE,
        agencyId: 'agency-nova',
        clientId: 'client-kafecito',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  describe('confirmación por enlace', () => {
    const invitation = {
      id: 'c-1',
      userId: 'u-1',
      companyName: 'Marca',
      confirmationStatus: ClientConfirmationStatus.PENDING,
      confirmationExpiresAt: new Date(Date.now() + 60000),
      agency: { id: 'a-1', name: 'Agencia', ownerUserId: 'owner' },
      user: { id: 'u-1', email: 'c@x.com', fullName: 'Cliente' },
    };
    const token = 'x'.repeat(64);

    it('activa el perfil con un token vigente', async () => {
      mockPrisma.client.findFirst.mockResolvedValueOnce(invitation);
      const result = await service.confirmIdentityByToken(token, 'ACCEPT');
      expect(result.status).toBe('CONFIRMED');
    });

    it('rechaza una invitación vencida', async () => {
      mockPrisma.client.findFirst.mockResolvedValueOnce({
        ...invitation,
        confirmationExpiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.confirmIdentityByToken(token, 'ACCEPT')).rejects.toThrow(BadRequestException);
    });

    it('no reabre una decisión ya tomada', async () => {
      mockPrisma.client.findFirst.mockResolvedValueOnce({
        ...invitation,
        confirmationStatus: ClientConfirmationStatus.CONFIRMED,
      });
      await expect(
        service.confirmIdentityInApp('c-1', { decision: 'REJECT' }, {
          sub: 'u-1',
          email: 'c@x.com',
          role: RoleCode.CLIENTE,
        }),
      ).rejects.toThrow('ya fue procesada');
    });
  });
});
