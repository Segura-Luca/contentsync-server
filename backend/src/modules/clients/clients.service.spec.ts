import { ForbiddenException } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { ClientsService } from './clients.service';

describe('ClientsService (Phase 3 Multi-tenant Agency & Client Isolation)', () => {
  const mockPrisma: any = {
    client: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockAudit: any = {
    log: jest.fn(),
  };

  let service: ClientsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClientsService(mockPrisma, mockAudit);
  });

  it('should filter clients by agencyId when requested by an AGENCIA role', async () => {
    mockPrisma.client.findMany.mockResolvedValueOnce([{ id: 'client-1', agencyId: 'agency-nova' }]);

    await service.findAllForUser({
      sub: 'user-agency-1',
      email: 'agencia@nova.com',
      role: RoleCode.AGENCIA,
      agencyId: 'agency-nova',
      clientId: null,
    });

    expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, agencyId: 'agency-nova' },
      }),
    );
  });

  it('should block an AGENCIA from accessing a client belonging to another agency', async () => {
    mockPrisma.client.findFirst.mockResolvedValueOnce({
      id: 'client-other',
      agencyId: 'agency-pulso',
    });

    await expect(
      service.assertClientAccess('client-other', {
        sub: 'user-agency-1',
        email: 'agencia@nova.com',
        role: RoleCode.AGENCIA,
        agencyId: 'agency-nova',
        clientId: null,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should block a CLIENTE from accessing another client resource', async () => {
    mockPrisma.client.findFirst.mockResolvedValueOnce({
      id: 'client-other',
      agencyId: 'agency-nova',
    });

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
});
