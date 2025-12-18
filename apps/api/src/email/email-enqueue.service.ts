import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailTemplateService } from './email-template.service';
import { EmailOutboxStatus, EmailAuditAction } from '@prisma/client';

export interface EnqueueResult {
  success: boolean;
  outboxId?: string;
  status: 'ENQUEUED' | 'SKIPPED' | 'ERROR';
  message?: string;
}

@Injectable()
export class EmailEnqueueService {
  private readonly logger = new Logger(EmailEnqueueService.name);

  constructor(
    private prisma: PrismaService,
    private templateService: EmailTemplateService,
  ) {}

  async enqueue(params: {
    instituteId: string;
    eventKey: string;
    toEmail: string;
    toName?: string | null;
    templateKey: string;
    payload: Record<string, any>;
    dedupKey: string;
    scheduledAt?: Date;
  }): Promise<EnqueueResult> {
    const {
      instituteId,
      eventKey,
      toEmail,
      toName,
      templateKey,
      payload,
      dedupKey,
      scheduledAt,
    } = params;
    try {
      // Check for duplicate
      const existing = await this.prisma.emailOutbox.findUnique({
        where: {
          instituteId_dedupKey: {
            instituteId,
            dedupKey,
          },
        },
      });

      if (existing) {
        // Log skip
        await this.prisma.emailAudit.create({
          data: {
            outboxId: existing.id,
            action: EmailAuditAction.SKIPPED,
            meta: { reason: 'duplicate', existingStatus: existing.status },
          },
        });

        this.logger.debug(`Email skipped (duplicate): ${dedupKey}`);
        return {
          success: true,
          outboxId: existing.id,
          status: 'SKIPPED',
          message: 'Email já enfileirado anteriormente',
        };
      }

      // Get active template
      const template = await this.templateService.findActiveByKey(templateKey);

      // Validate payload
      const validation = this.templateService.validatePayload(
        template.variablesSchema as any[],
        payload,
      );

      if (!validation.valid) {
        this.logger.warn(
          `Email enqueue failed: missing variables ${validation.missing.join(', ')}`,
        );
        return {
          success: false,
          status: 'ERROR',
          message: `Variáveis faltando: ${validation.missing.join(', ')}`,
        };
      }

      // Create outbox entry
      const outbox = await this.prisma.emailOutbox.create({
        data: {
          instituteId,
          eventKey,
          toEmail,
          toName: toName || undefined,
          templateKey: template.key,
          templateVersion: template.version,
          payload: payload as any,
          dedupKey,
          status: EmailOutboxStatus.PENDING,
          scheduledAt: scheduledAt || new Date(),
        },
      });

      // Log enqueue
      await this.prisma.emailAudit.create({
        data: {
          outboxId: outbox.id,
          action: EmailAuditAction.ENQUEUED,
          meta: { templateKey: template.key, templateVersion: template.version },
        },
      });

      this.logger.log(`Email enqueued: ${eventKey} to ${toEmail}`);
      return {
        success: true,
        outboxId: outbox.id,
        status: 'ENQUEUED',
      };
    } catch (error: any) {
      this.logger.error(`Email enqueue error: ${error.message}`);
      return {
        success: false,
        status: 'ERROR',
        message: error.message,
      };
    }
  }

  async getOutboxQueue(filters?: {
    status?: EmailOutboxStatus;
    eventKey?: string;
    limit?: number;
  }) {
    return this.prisma.emailOutbox.findMany({
      where: {
        status: filters?.status,
        eventKey: filters?.eventKey,
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 200,
      include: {
        audits: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
  }

  async getQueueStats() {
    const [pending, sending, sent, failed, cancelled, skipped] = await Promise.all([
      this.prisma.emailOutbox.count({ where: { status: EmailOutboxStatus.PENDING } }),
      this.prisma.emailOutbox.count({ where: { status: EmailOutboxStatus.SENDING } }),
      this.prisma.emailOutbox.count({ where: { status: EmailOutboxStatus.SENT } }),
      this.prisma.emailOutbox.count({ where: { status: EmailOutboxStatus.FAILED } }),
      this.prisma.emailOutbox.count({ where: { status: EmailOutboxStatus.CANCELLED } }),
      this.prisma.emailOutbox.count({ where: { status: EmailOutboxStatus.SKIPPED } }),
    ]);

    // Emails enviados nas últimas 24h
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const sentLast24h = await this.prisma.emailOutbox.count({
      where: {
        status: EmailOutboxStatus.SENT,
        sentAt: { gte: yesterday },
      },
    });

    // Por tipo de evento
    const byEventKey = await this.prisma.emailOutbox.groupBy({
      by: ['eventKey'],
      _count: { _all: true },
      where: {
        createdAt: { gte: yesterday },
      },
    });

    return {
      byStatus: { pending, sending, sent, failed, cancelled, skipped },
      sentLast24h,
      byEventKey: byEventKey.map((e) => ({
        eventKey: e.eventKey,
        count: e._count._all,
      })),
    };
  }

  async retryFailed(outboxId: string): Promise<EnqueueResult> {
    const existing = await this.prisma.emailOutbox.findUnique({
      where: { id: outboxId },
    });

    if (!existing) {
      return {
        success: false,
        status: 'ERROR',
        message: 'Outbox não encontrado',
      };
    }

    if (existing.status !== EmailOutboxStatus.FAILED && existing.status !== EmailOutboxStatus.CANCELLED) {
      return {
        success: false,
        status: 'ERROR',
        message: 'Somente emails FAILED ou CANCELLED podem ser reenviados',
      };
    }

    // Create new outbox with new dedupKey
    const newDedupKey = `${existing.dedupKey}:retry:${Date.now()}`;

    const newOutbox = await this.prisma.emailOutbox.create({
      data: {
        instituteId: existing.instituteId,
        eventKey: existing.eventKey,
        toEmail: existing.toEmail,
        toName: existing.toName,
        templateKey: existing.templateKey,
        templateVersion: existing.templateVersion,
        payload: existing.payload as any,
        dedupKey: newDedupKey,
        status: EmailOutboxStatus.PENDING,
        scheduledAt: new Date(),
      },
    });

    await this.prisma.emailAudit.create({
      data: {
        outboxId: newOutbox.id,
        action: EmailAuditAction.ENQUEUED,
        meta: { retryOf: outboxId },
      },
    });

    return {
      success: true,
      outboxId: newOutbox.id,
      status: 'ENQUEUED',
    };
  }
}
