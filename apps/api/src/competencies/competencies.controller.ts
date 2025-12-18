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
import { CompetenciesService } from './competencies.service';

@Controller()
export class CompetenciesController {
  constructor(private readonly competenciesService: CompetenciesService) {}

  // ============================================
  // CRUD DE COMPETÊNCIAS (GESTOR)
  // ============================================

  @Post('competencies')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async createCompetency(
    @Request() req: any,
    @Body() body: { name: string; description?: string },
  ) {
    return this.competenciesService.create(req.user.instituteId, body);
  }

  @Get('competencies')
  @UseGuards(JwtAuthGuard)
  async listCompetencies(@Request() req: any) {
    return this.competenciesService.findAll(req.user.instituteId);
  }

  @Get('competencies/:id')
  @UseGuards(JwtAuthGuard)
  async getCompetency(@Param('id') id: string) {
    return this.competenciesService.findById(id);
  }

  @Patch('competencies/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async updateCompetency(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.competenciesService.update(id, body);
  }

  @Delete('competencies/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async deleteCompetency(@Param('id') id: string) {
    return this.competenciesService.delete(id);
  }

  // ============================================
  // LIGAR COMPETÊNCIAS A AULAS
  // ============================================

  @Post('lessons/:lessonId/competencies')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async setLessonCompetencies(
    @Param('lessonId') lessonId: string,
    @Body() body: { competencyIds: string[] },
  ) {
    return this.competenciesService.setLessonCompetencies(
      lessonId,
      body.competencyIds,
    );
  }

  @Get('lessons/:lessonId/competencies')
  @UseGuards(JwtAuthGuard)
  async getLessonCompetencies(@Param('lessonId') lessonId: string) {
    return this.competenciesService.getLessonCompetencies(lessonId);
  }

  // ============================================
  // BANCO DE QUESTÕES
  // ============================================

  @Post('competencies/:id/questions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async addQuestionToBank(
    @Param('id') id: string,
    @Body() body: { questionId: string },
  ) {
    return this.competenciesService.addQuestionToBank(id, body.questionId);
  }

  @Delete('competencies/:id/questions/:questionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async removeQuestionFromBank(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
  ) {
    return this.competenciesService.removeQuestionFromBank(id, questionId);
  }

  @Get('competencies/:id/questions')
  @UseGuards(JwtAuthGuard)
  async getQuestionBank(@Param('id') id: string) {
    return this.competenciesService.getQuestionBank(id);
  }
}
