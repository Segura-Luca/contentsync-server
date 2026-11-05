import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma, RoleCode } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

/**
 * Las filas quedan porque el historial y la auditoría dependen de ellas, pero sin datos personales:
 * el correo y el identificador fiscal vuelven a quedar libres para registrarse.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storage: StorageService,
  ) {}

  async deleteOwnAccount(current: AuthenticatedUser, password: string | undefined, ipAddress?: string) {
    if (current.role === RoleCode.ADMIN_GENERAL) {
      throw new ForbiddenException('La cuenta de administrador no se puede eliminar.');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: current.sub },
      include: { ownedAgency: { include: { clients: { where: { deletedAt: null } } } }, clientProfile: true },
    });

    // Las cuentas creadas con Google, Facebook o GitHub no tienen contraseña que pedir.
    if (user.passwordHash && !(password && (await argon2.verify(user.passwordHash, password)))) {
      throw new BadRequestException('La contraseña es incorrecta.');
    }

    const agency = user.ownedAgency;
    const clients = agency ? agency.clients : user.clientProfile ? [user.clientProfile] : [];
    const clientIds = clients.map((client) => client.id);
    const userIds = [user.id, ...clients.map((client) => client.userId)];
    const uniqueUserIds = [...new Set(userIds)];
    const now = new Date();

    const videos = await this.prisma.video.findMany({
      where: { clientId: { in: clientIds }, deletedAt: null },
      select: { storageKey: true, thumbnailKey: true },
    });

    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.platformConnection.deleteMany({ where: { clientId: { in: clientIds } } }),
      this.prisma.video.updateMany({ where: { clientId: { in: clientIds }, deletedAt: null }, data: { deletedAt: now } }),
      this.prisma.client.updateMany({
        where: { id: { in: clientIds } },
        data: {
          deletedAt: now,
          isActive: false,
          companyName: 'Cliente eliminado',
          industry: null,
          confirmationToken: null,
          confirmationExpiresAt: null,
        },
      }),
      this.prisma.authSession.deleteMany({ where: { userId: { in: uniqueUserIds } } }),
      this.prisma.socialAuthAccount.deleteMany({ where: { userId: { in: uniqueUserIds } } }),
      this.prisma.notification.deleteMany({ where: { userId: { in: uniqueUserIds } } }),
      ...uniqueUserIds.map((id) =>
        this.prisma.user.update({
          where: { id },
          data: {
            email: `deleted_${id}@deleted.invalid`,
            fullName: 'Cuenta eliminada',
            passwordHash: null,
            verificationToken: null,
            verificationExpires: null,
            passwordResetToken: null,
            passwordResetExpires: null,
            fcmToken: null,
            isActive: false,
            deletedAt: now,
          },
        }),
      ),
    ];
    if (agency) {
      operations.push(
        this.prisma.agency.update({
          where: { id: agency.id },
          data: {
            deletedAt: now,
            isSuspended: true,
            name: 'Agencia eliminada',
            taxId: `DEL-${agency.id}`,
            contactPhone: null,
            website: null,
          },
        }),
      );
    }
    await this.prisma.$transaction(operations);

    await this.auditService.log({
      userId: user.id,
      action: 'ACCOUNT_SELF_DELETE',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    // Los archivos se borran al final: si esto falla, la cuenta ya no existe y solo queda un archivo huérfano.
    const keys = videos.flatMap((video) => [video.storageKey, video.thumbnailKey]).filter((key): key is string => !!key);
    await this.deleteFiles([...new Set(keys)]);

    return { message: 'Tu cuenta se eliminó correctamente.' };
  }

  private async deleteFiles(keys: string[]) {
    for (const key of keys) {
      try {
        // Una subida local no pertenece a un cliente: otro video activo podría usar el mismo archivo.
        const stillUsed = await this.prisma.video.count({
          where: { deletedAt: null, OR: [{ storageKey: key }, { thumbnailKey: key }] },
        });
        if (!stillUsed) await this.storage.deleteObject(key);
      } catch (error: any) {
        this.logger.error(`No se pudo borrar el archivo de una cuenta eliminada: ${error?.name}: ${error?.message}`);
      }
    }
  }
}
