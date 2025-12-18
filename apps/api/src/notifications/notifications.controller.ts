import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('me/notifications')
  @UseGuards(JwtAuthGuard)
  async getMyNotifications(
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getMyNotifications(
      req.user.id,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('me/notifications/count')
  @UseGuards(JwtAuthGuard)
  async getUnreadCount(@Request() req: any) {
    const unreadCount = await this.notificationsService.getUnreadCount(
      req.user.id,
    );
    return { unreadCount };
  }

  @Patch('notifications/:id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }

  @Patch('notifications/read-all')
  @UseGuards(JwtAuthGuard)
  async markAllAsRead(@Request() req: any) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }
}
