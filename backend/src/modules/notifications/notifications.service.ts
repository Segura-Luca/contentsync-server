import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';

export interface SendPushNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  referenceId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async notifyUser(input: SendPushNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        referenceId: input.referenceId ?? null,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { fcmToken: true },
    });

    if (user?.fcmToken) {
      // El envío por Firebase todavía no está implementado: la notificación queda disponible dentro de la app.
      this.logger.debug(
        this.config.fcmMockMode
          ? `[FCM simulado] ${input.type}: ${input.title}`
          : `[FCM sin implementar] Push omitido para ${input.type}.`,
      );
    }

    return notification;
  }

  async listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(id: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    return { id, isRead: true };
  }

  async updateFcmToken(userId: string, fcmToken: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });
    return { message: 'Token FCM actualizado correctamente.' };
  }
}
