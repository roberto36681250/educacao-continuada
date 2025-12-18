import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus, TicketCategory, TicketPriority } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_PATH = path.join(process.cwd(), 'storage', 'tickets');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'application/pdf'];

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {
    // Ensure storage directory exists
    if (!fs.existsSync(STORAGE_PATH)) {
      fs.mkdirSync(STORAGE_PATH, { recursive: true });
    }
  }

  // ============================================
  // ALUNO ENDPOINTS
  // ============================================

  async createTicket(
    userId: string,
    instituteId: string,
    data: {
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
    const ticket = await this.prisma.ticket.create({
      data: {
        instituteId,
        createdByUserId: userId,
        subject: data.subject,
        category: data.category || TicketCategory.OTHER,
        priority: data.priority || TicketPriority.MEDIUM,
        courseId: data.courseId,
        lessonId: data.lessonId,
        quizAttemptId: data.quizAttemptId,
        assignmentId: data.assignmentId,
        messages: {
          create: {
            authorUserId: userId,
            message: data.message,
          },
        },
      },
      include: {
        messages: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Notify managers about new ticket
    await this.notifyManagers(instituteId, ticket.id, ticket.subject);

    return ticket;
  }

  async getMyTickets(userId: string) {
    return this.prisma.ticket.findMany({
      where: { createdByUserId: userId },
      include: {
        course: { select: { id: true, title: true } },
        lesson: { select: { id: true, title: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTicketById(ticketId: string, userId: string, userRole: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        createdBy: { select: { id: true, name: true, email: true, profession: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
        lesson: { select: { id: true, title: true } },
        quizAttempt: { select: { id: true, score: true, status: true } },
        messages: {
          include: {
            author: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          include: {
            uploadedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket não encontrado');
    }

    // Check access
    const isOwner = ticket.createdByUserId === userId;
    const isManager = ['ADMIN_MASTER', 'ADMIN', 'MANAGER'].includes(userRole);

    if (!isOwner && !isManager) {
      throw new ForbiddenException('Sem permissão para acessar este ticket');
    }

    return ticket;
  }

  async addMessage(
    ticketId: string,
    userId: string,
    userRole: string,
    message: string,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket não encontrado');
    }

    const isOwner = ticket.createdByUserId === userId;
    const isManager = ['ADMIN_MASTER', 'ADMIN', 'MANAGER'].includes(userRole);

    if (!isOwner && !isManager) {
      throw new ForbiddenException('Sem permissão');
    }

    const newMessage = await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        authorUserId: userId,
        message,
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
    });

    // If manager replied, notify ticket creator
    if (isManager && !isOwner) {
      await this.createNotification(
        ticket.instituteId,
        ticket.createdByUserId,
        'TICKET_REPLY',
        'Nova resposta no seu ticket',
        `Seu ticket "${ticket.subject}" recebeu uma resposta.`,
      );
    }

    // Update ticket status to IN_PROGRESS if it was OPEN
    if (ticket.status === TicketStatus.OPEN) {
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.IN_PROGRESS },
      });
    }

    return newMessage;
  }

  async addAttachment(
    ticketId: string,
    userId: string,
    userRole: string,
    file: Express.Multer.File,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket não encontrado');
    }

    const isOwner = ticket.createdByUserId === userId;
    const isManager = ['ADMIN_MASTER', 'ADMIN', 'MANAGER'].includes(userRole);

    if (!isOwner && !isManager) {
      throw new ForbiddenException('Sem permissão');
    }

    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('Arquivo excede 5MB');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Tipo de arquivo não permitido. Use PNG, JPG ou PDF.');
    }

    // Generate unique filename
    const ext = path.extname(file.originalname);
    const filename = `${ticketId}-${Date.now()}${ext}`;
    const storagePath = path.join(STORAGE_PATH, filename);

    // Save file
    fs.writeFileSync(storagePath, file.buffer);

    // Create attachment record
    const attachment = await this.prisma.ticketAttachment.create({
      data: {
        ticketId,
        uploadedByUserId: userId,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath,
      },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    return attachment;
  }

  async closeTicketByUser(ticketId: string, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket não encontrado');
    }

    if (ticket.createdByUserId !== userId) {
      throw new ForbiddenException('Somente o criador pode fechar o ticket');
    }

    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.CLOSED },
    });
  }

  // ============================================
  // GESTOR ENDPOINTS
  // ============================================

  async listTickets(
    instituteId: string,
    filters: {
      from?: string;
      to?: string;
      status?: TicketStatus;
      category?: TicketCategory;
      priority?: TicketPriority;
    },
  ) {
    const where: any = { instituteId };

    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) {
        where.createdAt.gte = new Date(filters.from);
      }
      if (filters.to) {
        where.createdAt.lte = new Date(filters.to + 'T23:59:59Z');
      }
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.priority) {
      where.priority = filters.priority;
    }

    return this.prisma.ticket.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true, email: true, profession: true } },
        assignedTo: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async updateTicketStatus(
    ticketId: string,
    status: TicketStatus,
    instituteId: string,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.instituteId !== instituteId) {
      throw new NotFoundException('Ticket não encontrado');
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status },
    });

    // Notify user about status change
    if (status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED) {
      await this.createNotification(
        ticket.instituteId,
        ticket.createdByUserId,
        'TICKET_STATUS',
        status === TicketStatus.RESOLVED
          ? 'Seu ticket foi resolvido'
          : 'Seu ticket foi fechado',
        `O ticket "${ticket.subject}" foi ${status === TicketStatus.RESOLVED ? 'resolvido' : 'fechado'}.`,
      );
    }

    return updated;
  }

  async assignTicket(
    ticketId: string,
    assignedToUserId: string | null,
    instituteId: string,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.instituteId !== instituteId) {
      throw new NotFoundException('Ticket não encontrado');
    }

    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assignedToUserId,
        status:
          ticket.status === TicketStatus.OPEN
            ? TicketStatus.IN_PROGRESS
            : ticket.status,
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
      },
    });
  }

  async exportTicketsCSV(
    instituteId: string,
    from?: string,
    to?: string,
  ): Promise<string> {
    const where: any = { instituteId };

    if (from || to) {
      where.createdAt = {};
      if (from) {
        where.createdAt.gte = new Date(from);
      }
      if (to) {
        where.createdAt.lte = new Date(to + 'T23:59:59Z');
      }
    }

    const tickets = await this.prisma.ticket.findMany({
      where,
      include: {
        createdBy: { select: { name: true, email: true, profession: true } },
        assignedTo: { select: { name: true } },
        course: { select: { title: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const header =
      'ID,Assunto,Categoria,Prioridade,Status,Criador,Email,Profissão,Curso,Atribuído a,Mensagens,Criado em\n';
    const rows = tickets.map((t) =>
      [
        t.id,
        `"${t.subject.replace(/"/g, '""')}"`,
        t.category,
        t.priority,
        t.status,
        `"${t.createdBy.name}"`,
        t.createdBy.email,
        t.createdBy.profession || '',
        t.course?.title || '',
        t.assignedTo?.name || '',
        t._count.messages,
        t.createdAt.toISOString(),
      ].join(','),
    );

    return header + rows.join('\n');
  }

  // ============================================
  // ATTACHMENT DOWNLOAD
  // ============================================

  async getAttachmentForDownload(
    attachmentId: string,
    userId: string,
    userRole: string,
  ) {
    const attachment = await this.prisma.ticketAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        ticket: true,
      },
    });

    if (!attachment) {
      throw new NotFoundException('Anexo não encontrado');
    }

    const isOwner = attachment.ticket.createdByUserId === userId;
    const isManager = ['ADMIN_MASTER', 'ADMIN', 'MANAGER'].includes(userRole);

    if (!isOwner && !isManager) {
      throw new ForbiddenException('Sem permissão para baixar este anexo');
    }

    return attachment;
  }

  // ============================================
  // HELPERS
  // ============================================

  private async notifyManagers(
    instituteId: string,
    ticketId: string,
    subject: string,
  ) {
    const managers = await this.prisma.user.findMany({
      where: {
        instituteId,
        role: { in: ['ADMIN_MASTER', 'ADMIN', 'MANAGER'] },
        isActive: true,
      },
      select: { id: true },
    });

    const notifications = managers.map((m) => ({
      instituteId,
      userId: m.id,
      type: 'TICKET_REPLY' as const,
      title: 'Novo ticket de suporte',
      body: `Um novo ticket foi aberto: "${subject}"`,
    }));

    if (notifications.length > 0) {
      await this.prisma.notification.createMany({ data: notifications });
    }
  }

  private async createNotification(
    instituteId: string,
    userId: string,
    type: 'TICKET_REPLY' | 'TICKET_STATUS' | 'ASSIGNMENT_NEW' | 'CERTIFICATE_ISSUED',
    title: string,
    body: string,
  ) {
    await this.prisma.notification.create({
      data: {
        instituteId,
        userId,
        type,
        title,
        body,
      },
    });
  }
}
