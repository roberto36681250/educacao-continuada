import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FAQService } from './faq.service';
import { FAQStatus } from '@prisma/client';

@Controller()
export class FAQController {
  constructor(private readonly faqService: FAQService) {}

  // ============================================
  // PUBLIC ENDPOINTS (for logged users)
  // ============================================

  @Get('courses/:courseId/faq')
  @UseGuards(JwtAuthGuard)
  async getFAQsByCourse(@Param('courseId') courseId: string) {
    return this.faqService.getFAQsByCourse(courseId);
  }

  // ============================================
  // GESTOR/PROFESSOR ENDPOINTS
  // ============================================

  @Get('courses/:courseId/faq/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async getAllFAQsByCourse(
    @Param('courseId') courseId: string,
    @Request() req: any,
  ) {
    return this.faqService.getAllFAQsByCourse(courseId, req.user.instituteId);
  }

  @Post('courses/:courseId/faq')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async createFAQ(
    @Param('courseId') courseId: string,
    @Request() req: any,
    @Body()
    body: {
      question: string;
      answer: string;
      status?: FAQStatus;
    },
  ) {
    return this.faqService.createFAQ(req.user.id, req.user.instituteId, {
      courseId,
      ...body,
    });
  }

  @Patch('faq/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async updateFAQ(
    @Param('id') id: string,
    @Request() req: any,
    @Body()
    body: {
      question?: string;
      answer?: string;
    },
  ) {
    return this.faqService.updateFAQ(id, req.user.instituteId, body);
  }

  @Patch('faq/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async updateFAQStatus(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { status: FAQStatus },
  ) {
    return this.faqService.updateFAQStatus(
      id,
      body.status,
      req.user.instituteId,
    );
  }

  @Delete('faq/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async deleteFAQ(@Param('id') id: string, @Request() req: any) {
    return this.faqService.deleteFAQ(id, req.user.instituteId);
  }
}
