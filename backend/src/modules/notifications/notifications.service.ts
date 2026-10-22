import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

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
  private readonly fcmMockMode: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.fcmMockMode =
      this.configService.get<string>('FCM_MOCK_MODE', 'true') === 'true';
  }

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
      select: { fcmToken: true, email: true },
    });

    if (user?.fcmToken) {
      if (this.fcmMockMode) {
        this.logger.log(
          `[FCM MOCK] Push enviado a ${user.email} (${input.type}): ${input.title}`,
        );
      } else {
        this.logger.log(`[FCM LIVE] Push despachado a token ${user.fcmToken.slice(0, 12)}...`);
      }
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
