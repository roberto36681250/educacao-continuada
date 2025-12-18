import { Module } from '@nestjs/common';
import { EmailEnqueueService } from './email-enqueue.service';
import { EmailTemplateService } from './email-template.service';
import { EmailPreferenceService } from './email-preference.service';
import { EmailWorkerService } from './email-worker.service';
import { EmailSchedulerService } from './email-scheduler.service';
import {
  EmailController,
  EmailTemplateController,
  EmailPreferenceController,
  EmailQueueController,
} from './email.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    EmailController,
    EmailTemplateController,
    EmailPreferenceController,
    EmailQueueController,
  ],
  providers: [
    EmailEnqueueService,
    EmailTemplateService,
    EmailPreferenceService,
    EmailWorkerService,
    EmailSchedulerService,
  ],
  exports: [
    EmailEnqueueService,
    EmailTemplateService,
    EmailPreferenceService,
    EmailWorkerService,
    EmailSchedulerService,
  ],
})
export class EmailModule {}
