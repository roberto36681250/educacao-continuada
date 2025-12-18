import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { EmailTemplateService, TemplateVariable } from './email-template.service';
import { EmailPreferenceService } from './email-preference.service';
import { EmailEnqueueService } from './email-enqueue.service';
import { EmailWorkerService } from './email-worker.service';
import { EmailSchedulerService } from './email-scheduler.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EmailOutboxStatus } from '@prisma/client';

@Controller('gestor/email-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailTemplateController {
  constructor(private readonly templateService: EmailTemplateService) {}

  @Get()
  @Roles('ADMIN_MASTER', 'MANAGER')
  async findAll() {
    return this.templateService.findAll();
  }

  @Post()
  @Roles('ADMIN_MASTER', 'MANAGER')
  async create(
    @Body()
    body: {
      key: string;
      subject: string;
      htmlBody: string;
      textBody: string;
      variablesSchema: TemplateVariable[];
    },
    @Request() req: any,
  ) {
    return this.templateService.create({
      ...body,
      createdByUserId: req.user.id,
    });
  }

  @Patch(':id')
  @Roles('ADMIN_MASTER', 'MANAGER')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      subject?: string;
      htmlBody?: string;
      textBody?: string;
      variablesSchema?: TemplateVariable[];
      isActive?: boolean;
    },
  ) {
    return this.templateService.update(id, body);
  }
}

@Controller('me/email-preferences')
@UseGuards(JwtAuthGuard)
export class EmailPreferenceController {
  constructor(private readonly preferenceService: EmailPreferenceService) {}

  @Get()
  async get(@Request() req: any) {
    return this.preferenceService.getOrCreate(req.user.id);
  }

  @Patch()
  async update(
    @Request() req: any,
    @Body()
    body: {
      emailEnabled?: boolean;
      digestEnabled?: boolean;
      remindersEnabled?: boolean;
    },
  ) {
    return this.preferenceService.update(req.user.id, body);
  }
}

@Controller('gestor/comunicacao')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailQueueController {
  constructor(
    private readonly enqueueService: EmailEnqueueService,
    private readonly workerService: EmailWorkerService,
    private readonly schedulerService: EmailSchedulerService,
  ) {}

  @Get('fila')
  @Roles('ADMIN_MASTER', 'MANAGER')
  async getQueue(
    @Query('status') status?: EmailOutboxStatus,
    @Query('eventKey') eventKey?: string,
  ) {
    return this.enqueueService.getOutboxQueue({
      status,
      eventKey,
      limit: 200,
    });
  }

  @Get('estatisticas')
  @Roles('ADMIN_MASTER', 'MANAGER')
  async getStats() {
    return this.enqueueService.getQueueStats();
  }

  @Post('reenviar/:id')
  @Roles('ADMIN_MASTER', 'MANAGER')
  async retry(@Param('id') id: string) {
    return this.enqueueService.retryFailed(id);
  }

  @Post('processar')
  @Roles('ADMIN_MASTER')
  async triggerProcess() {
    return this.workerService.triggerProcess();
  }

  @Post('scheduler/daily-reminders')
  @Roles('ADMIN_MASTER')
  async runDailyReminders() {
    return this.schedulerService.runDailyReminders();
  }

  @Post('scheduler/weekly-digest')
  @Roles('ADMIN_MASTER')
  async runWeeklyDigest() {
    return this.schedulerService.sendWeeklyDigest();
  }
}

// Combined controller export
@Controller()
export class EmailController {}
