import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import * as argon2 from 'argon2';
import { AccountDeletionService } from './account-deletion.service';

describe('AccountDeletionService', () => {
  const op = () => jest.fn().mockResolvedValue({});
  let prisma: any;
  let storage: { deleteObject: jest.Mock };
  let service: AccountDeletionService;

  const agencyUser = { sub: 'owner', role: RoleCode.AGENCIA } as any;
  const clientUser = { sub: 'client-user', role: RoleCode.CLIENTE } as any;

  beforeEach(() => {
    prisma = {
      user: { findUniqueOrThrow: jest.fn(), update: op() },
      video: {
        findMany: jest.fn().mockResolvedValue([{ storageKey: 'clients/c1/a.mp4', thumbnailKey: null }]),
        updateMany: op(),
        count: jest.fn().mockResolvedValue(0),
      },
      platformConnection: { deleteMany: op() },
      client: { updateMany: op() },
      agency: { update: op() },
      authSession: { deleteMany: op() },
      socialAuthAccount: { deleteMany: op() },
      notification: { deleteMany: op() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    storage = { deleteObject: jest.fn().mockResolvedValue(undefined) };
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
    expect(prisma.platformConnection.deleteMany).toHaveBeenCalledWith({ where: { clientId: { in: ['c1'] } } });
    expect(storage.deleteObject).toHaveBeenCalledWith('clients/c1/a.mp4');
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

  it('no borra un archivo que otro video activo sigue usando', async () => {
    asAgency(null);
    prisma.video.count.mockResolvedValue(1);

    await service.deleteOwnAccount(agencyUser, undefined);

    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('un fallo al borrar archivos no revierte la eliminación', async () => {
    asAgency(null);
    storage.deleteObject.mockRejectedValue(new Error('s3 caído'));

    await expect(service.deleteOwnAccount(agencyUser, undefined)).resolves.toMatchObject({ message: expect.any(String) });
  });
});
