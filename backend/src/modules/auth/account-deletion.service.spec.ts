import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import * as argon2 from 'argon2';
import { AccountDeletionService } from './account-deletion.service';

describe('AccountDeletionService', () => {
  const op = () => jest.fn().mockResolvedValue({});
  let prisma: any;
  let storage: { deleteIfUnused: jest.Mock };
  let service: AccountDeletionService;

  const agencyUser = { sub: 'owner', role: RoleCode.AGENCIA } as any;
  const clientUser = { sub: 'client-user', role: RoleCode.CLIENTE } as any;

  beforeEach(() => {
    prisma = {
      user: { findUniqueOrThrow: jest.fn(), update: op() },
      scheduleItemMedia: {
        findMany: jest.fn().mockResolvedValue([{ storageKey: 'clients/c1/a.mp4' }]),
        deleteMany: op(),
      },
      client: { updateMany: op() },
      agency: { update: op() },
      authSession: { deleteMany: op() },
      socialAuthAccount: { deleteMany: op() },
      notification: { deleteMany: op() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    storage = { deleteIfUnused: jest.fn().mockResolvedValue(undefined) };
    service = new AccountDeletionService(prisma, { log: jest.fn() } as any, storage as any);
  });

  const asAgency = (passwordHash: string | null) =>
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'owner',
      passwordHash,
      clientProfile: null,
      ownedAgency: { id: 'agency', clients: [{ id: 'c1', userId: 'client-user' }] },
    });

  it('nunca elimina al administrador', async () => {
    await expect(service.deleteOwnAccount({ sub: 'admin', role: RoleCode.ADMIN_GENERAL } as any, 'x')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza una contraseña incorrecta sin borrar nada', async () => {
    asAgency(await argon2.hash('correcta'));
    await expect(service.deleteOwnAccount(agencyUser, 'otra')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.deleteOwnAccount(agencyUser, undefined)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('una agencia elimina también a sus clientes y anonimiza los datos', async () => {
    asAgency(null);

    await service.deleteOwnAccount(agencyUser, undefined);

    const updated = prisma.user.update.mock.calls.map(([call]: any) => call);
    expect(updated.map((call: any) => call.where.id).sort()).toEqual(['client-user', 'owner']);
    expect(updated[0].data).toMatchObject({ email: 'deleted_owner@deleted.invalid', passwordHash: null, isActive: false });
    expect(prisma.agency.update.mock.calls[0][0].data).toMatchObject({ taxId: 'DEL-agency', isSuspended: true });
    expect(prisma.scheduleItemMedia.deleteMany).toHaveBeenCalledWith({
      where: { scheduleItem: { schedule: { clientId: { in: ['c1'] } } } },
    });
    expect(storage.deleteIfUnused).toHaveBeenCalledWith(['clients/c1/a.mp4']);
  });

  it('un cliente solo se elimina a sí mismo', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'client-user',
      passwordHash: null,
      ownedAgency: null,
      clientProfile: { id: 'c1', userId: 'client-user' },
    });

    await service.deleteOwnAccount(clientUser, undefined);

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.agency.update).not.toHaveBeenCalled();
  });

});
