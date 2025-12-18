import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { EmailTemplateService } from './email-template.service';
import { EmailPreferenceService } from './email-preference.service';
import { EmailOutboxStatus, EmailAuditAction } from '@prisma/client';

@Injectable()
export class EmailWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailWorkerService.name);
  private resend: Resend | null = null;
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private templateService: EmailTemplateService,
    private preferenceService: EmailPreferenceService,
  ) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const workerEnabled = this.configService.get<string>('EMAIL_WORKER_ENABLED') === 'true';

    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('Resend client initialized');
    } else {
      this.logger.warn('RESEND_API_KEY not configured - emails will fail');
    }

    if (workerEnabled) {
      this.startWorker();
    } else {
      this.logger.log('Email worker disabled (EMAIL_WORKER_ENABLED != true)');
    }
  }

  onModuleDestroy() {
    this.stopWorker();
  }

  startWorker() {
    if (this.interval) return;

    this.logger.log('Starting email worker (5s interval)');
    this.interval = setInterval(() => this.processQueue(), 5000);
  }

  stopWorker() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.logger.log('Email worker stopped');
    }
  }

  async processQueue() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // Fetch pending emails ready to send
      const pending = await this.prisma.emailOutbox.findMany({
        where: {
          status: EmailOutboxStatus.PENDING,
          scheduledAt: { lte: new Date() },
        },
        take: 20,
        orderBy: { scheduledAt: 'asc' },
      });

      if (pending.length === 0) {
        this.isRunning = false;
        return;
      }

      this.logger.log(`Processing ${pending.length} emails`);

      for (const outbox of pending) {
        await this.processEmail(outbox);
      }
    } catch (error: any) {
      this.logger.error(`Queue processing error: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async processEmail(outbox: any) {
    const { id, toEmail, templateKey, payload } = outbox;

    try {
      // Mark as sending
      await this.prisma.emailOutbox.update({
        where: { id },
        data: { status: EmailOutboxStatus.SENDING },
      });

      // Check user preferences (find user by email)
      const user = await this.prisma.user.findUnique({
        where: { email: toEmail },
      });

      if (user) {
        const canSend = await this.preferenceService.canSendEmail(user.id);
        if (!canSend) {
          await this.markSkipped(id, 'User has disabled emails');
          return;
        }
      }

      // Get template and render
      const template = await this.prisma.emailTemplate.findUnique({
        where: { key: templateKey },
      });

      if (!template) {
        await this.markFailed(id, `Template ${templateKey} not found`);
        return;
      }

      const renderedSubject = this.templateService.renderTemplate(
        template.subject,
        payload as Record<string, any>,
      );
      const renderedHtml = this.templateService.renderTemplate(
        template.htmlBody,
        payload as Record<string, any>,
      );
      const renderedText = this.templateService.renderTemplate(
        template.textBody,
        payload as Record<string, any>,
      );

      // Send via Resend
      if (!this.resend) {
        await this.markFailed(id, 'Resend not configured');
        return;
      }

      const emailFrom = this.configService.get<string>('EMAIL_FROM') || 'noreply@example.com';

      const result = await this.resend.emails.send({
        from: emailFrom,
        to: toEmail,
        subject: renderedSubject,
        html: renderedHtml,
        text: renderedText,
      });

      if (result.error) {
        await this.markFailed(id, result.error.message);
        return;
      }

      // Mark as sent
      await this.prisma.emailOutbox.update({
        where: { id },
        data: {
          status: EmailOutboxStatus.SENT,
          sentAt: new Date(),
          providerMessageId: result.data?.id,
        },
      });

      await this.prisma.emailAudit.create({
        data: {
          outboxId: id,
          action: EmailAuditAction.SENT,
          meta: { messageId: result.data?.id },
        },
      });

      this.logger.log(`Email sent: ${id} to ${toEmail}`);
    } catch (error: any) {
      await this.markFailed(id, error.message);
    }
  }

  private async markFailed(id: string, error: string) {
    const outbox = await this.prisma.emailOutbox.findUnique({ where: { id } });
    if (!outbox) return;

    const attempts = outbox.attempts + 1;
    let nextStatus: EmailOutboxStatus = EmailOutboxStatus.FAILED;
    let scheduledAt = outbox.scheduledAt;

    // Backoff schedule
    if (attempts < 4) {
      nextStatus = EmailOutboxStatus.PENDING;
      const backoffMinutes = [1, 5, 30][attempts - 1] || 30;
      scheduledAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
      this.logger.warn(`Email ${id} failed, retry #${attempts} in ${backoffMinutes}min`);
    } else {
      nextStatus = EmailOutboxStatus.CANCELLED;
      this.logger.error(`Email ${id} cancelled after ${attempts} attempts`);
    }

    await this.prisma.emailOutbox.update({
      where: { id },
      data: {
        status: nextStatus,
        attempts,
        lastError: error,
        scheduledAt,
      },
    });

    await this.prisma.emailAudit.create({
      data: {
        outboxId: id,
        action: EmailAuditAction.FAILED,
        meta: { error, attempts },
      },
    });
  }

  private async markSkipped(id: string, reason: string) {
    await this.prisma.emailOutbox.update({
      where: { id },
      data: { status: EmailOutboxStatus.SKIPPED },
    });

    await this.prisma.emailAudit.create({
      data: {
        outboxId: id,
        action: EmailAuditAction.SKIPPED,
        meta: { reason },
      },
    });

    this.logger.log(`Email ${id} skipped: ${reason}`);
  }

  // Manual trigger for testing
  async triggerProcess() {
    await this.processQueue();
    return { processed: true };
  }
}
