import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TicketsService } from './tickets.service';
import { TicketStatus, TicketCategory, TicketPriority } from '@prisma/client';
import * as fs from 'fs';

@Controller()
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // ============================================
  // ALUNO ENDPOINTS
  // ============================================

  // Rate limit: 30 requests per minute for ticket creation
  @Post('tickets')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async createTicket(
    @Request() req: any,
    @Body()
    body: {
      subject: string;
      message: string;
      category?: TicketCategory;
      priority?: TicketPriority;
      courseId?: string;
      lessonId?: string;
      quizAttemptId?: string;
      assignmentId?: string;
    },
  ) {
    return this.ticketsService.createTicket(
      req.user.id,
      req.user.instituteId,
      body,
    );
  }

  @Get('me/tickets')
  @UseGuards(JwtAuthGuard)
  async getMyTickets(@Request() req: any) {
    return this.ticketsService.getMyTickets(req.user.id);
  }

  // IMPORTANT: These specific routes must come BEFORE tickets/:id
  @Get('tickets/export.csv')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async exportTicketsCSV(
    @Request() req: any,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const csv = await this.ticketsService.exportTicketsCSV(
      req.user.instituteId,
      from,
      to,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=tickets-${new Date().toISOString().split('T')[0]}.csv`,
    );
    res.send('\ufeff' + csv); // BOM for Excel
  }

  @Get('tickets/attachments/:attachmentId/download')
  @UseGuards(JwtAuthGuard)
  async downloadAttachment(
    @Param('attachmentId') attachmentId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const attachment = await this.ticketsService.getAttachmentForDownload(
      attachmentId,
      req.user.id,
      req.user.role,
    );

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${attachment.filename}"`,
    );

    const stream = fs.createReadStream(attachment.storagePath);
    stream.pipe(res);
  }

  @Get('tickets/:id')
  @UseGuards(JwtAuthGuard)
  async getTicketById(@Param('id') id: string, @Request() req: any) {
    return this.ticketsService.getTicketById(id, req.user.id, req.user.role);
  }

  @Post('tickets/:id/messages')
  @UseGuards(JwtAuthGuard)
  async addMessage(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { message: string },
  ) {
    return this.ticketsService.addMessage(
      id,
      req.user.id,
      req.user.role,
      body.message,
    );
  }

  @Post('tickets/:id/attachments')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async addAttachment(
    @Param('id') id: string,
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.ticketsService.addAttachment(
      id,
      req.user.id,
      req.user.role,
      file,
    );
  }

  @Patch('tickets/:id/close')
  @UseGuards(JwtAuthGuard)
  async closeTicket(@Param('id') id: string, @Request() req: any) {
    return this.ticketsService.closeTicketByUser(id, req.user.id);
  }

  // ============================================
  // GESTOR ENDPOINTS
  // ============================================

  @Get('tickets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async listTickets(
    @Request() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: TicketStatus,
    @Query('category') category?: TicketCategory,
    @Query('priority') priority?: TicketPriority,
  ) {
    return this.ticketsService.listTickets(req.user.instituteId, {
      from,
      to,
      status,
      category,
      priority,
    });
  }

  @Patch('tickets/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async updateTicketStatus(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { status: TicketStatus },
  ) {
    return this.ticketsService.updateTicketStatus(
      id,
      body.status,
      req.user.instituteId,
    );
  }

  @Patch('tickets/:id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async assignTicket(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { assignedToUserId: string | null },
  ) {
    return this.ticketsService.assignTicket(
      id,
      body.assignedToUserId,
      req.user.instituteId,
    );
  }
}
