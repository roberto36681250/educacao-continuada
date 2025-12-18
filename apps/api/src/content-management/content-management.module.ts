import { Module } from '@nestjs/common';
import {
  ContentManagementController,
  CourseVersionController,
} from './content-management.controller';
import { ContentManagementService } from './content-management.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ContentManagementController, CourseVersionController],
  providers: [ContentManagementService],
  exports: [ContentManagementService],
})
export class ContentManagementModule {}
