import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReviewsService } from './reviews.service';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ============================================
  // ALUNO ENDPOINTS
  // ============================================

  @Get('me/reviews')
  @UseGuards(JwtAuthGuard)
  async getMyReviews(@Request() req: any) {
    return this.reviewsService.getMyReviews(req.user.id);
  }

  @Get('me/competencies')
  @UseGuards(JwtAuthGuard)
  async getMyCompetencies(@Request() req: any) {
    return this.reviewsService.getMyCompetencies(req.user.id);
  }

  @Post('reviews/:scheduleId/start')
  @UseGuards(JwtAuthGuard)
  async startReview(
    @Param('scheduleId') scheduleId: string,
    @Request() req: any,
  ) {
    return this.reviewsService.startReview(scheduleId, req.user.id);
  }

  @Post('reviews/:scheduleId/submit')
  @UseGuards(JwtAuthGuard)
  async submitReview(
    @Param('scheduleId') scheduleId: string,
    @Request() req: any,
    @Body()
    body: {
      answers: Array<{ questionId: string; selectedOptionIds: string[] }>;
    },
  ) {
    return this.reviewsService.submitReview(
      scheduleId,
      req.user.id,
      body.answers,
    );
  }

  // ============================================
  // GESTOR ENDPOINTS - MAPA DE RISCO
  // ============================================

  @Get('gestor/risk-map')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async getRiskMap(
    @Request() req: any,
    @Query('groupBy') groupBy: 'UNIT' | 'PROFESSION' | 'UNIT_PROFESSION' = 'UNIT',
  ) {
    return this.reviewsService.getRiskMap(req.user.instituteId, groupBy);
  }

  @Get('gestor/risk-map/export.csv')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async exportRiskMapCSV(
    @Request() req: any,
    @Res() res: Response,
    @Query('groupBy') groupBy: 'UNIT' | 'PROFESSION' | 'UNIT_PROFESSION' = 'UNIT',
  ) {
    const csv = await this.reviewsService.exportRiskMapCSV(
      req.user.instituteId,
      groupBy,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=risk-map-${new Date().toISOString().split('T')[0]}.csv`,
    );
    res.send('\ufeff' + csv);
  }
}
