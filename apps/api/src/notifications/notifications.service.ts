import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyNotifications(userId: string, limit?: number) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit || 50,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notificação não encontrada');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return { message: 'Todas as notificações foram marcadas como lidas' };
  }

  // Helper method to create notifications (used by other services)
  async createNotification(
    instituteId: string,
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
  ) {
    return this.prisma.notification.create({
      data: {
        instituteId,
        userId,
        type,
        title,
        body,
      },
    });
  }

  // Bulk create notifications
  async createBulkNotifications(
    notifications: Array<{
      instituteId: string;
      userId: string;
      type: NotificationType;
      title: string;
      body: string;
    }>,
  ) {
    return this.prisma.notification.createMany({
      data: notifications,
    });
  }
}
