import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { QuizzesService } from './quizzes.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { CreateQuestionDto, UpdateQuestionDto } from './dto/create-question.dto';
import { CreateOptionDto, UpdateOptionDto } from './dto/create-option.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  // ============================================
  // ADMIN/PROFESSOR ENDPOINTS
  // ============================================

  // Criar ou atualizar quiz de uma aula
  @Post('lessons/:lessonId/quiz')
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async createOrUpdateQuiz(
    @Param('lessonId') lessonId: string,
    @Body() dto: Partial<CreateQuizDto>,
  ) {
    return this.quizzesService.createOrUpdateQuiz({
      lessonId,
      ...dto,
    });
  }

  // Listar questões de uma aula (para editor)
  @Get('lessons/:lessonId/questions')
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async getQuestionsByLesson(@Param('lessonId') lessonId: string) {
    return this.quizzesService.getQuestionsByLesson(lessonId);
  }

  // Criar questão
  @Post('lessons/:lessonId/questions')
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async createQuestion(
    @Param('lessonId') lessonId: string,
    @Body() dto: Omit<CreateQuestionDto, 'quizId'>,
  ) {
    // Primeiro, garantir que o quiz existe
    const quiz = await this.quizzesService.getQuizByLesson(lessonId);
    if (!quiz) {
      // Criar quiz automaticamente
      const newQuiz = await this.quizzesService.createOrUpdateQuiz({ lessonId });
      return this.quizzesService.createQuestion({
        ...dto,
        quizId: newQuiz.id,
      });
    }
    return this.quizzesService.createQuestion({
      ...dto,
      quizId: quiz.id,
    });
  }

  // Atualizar questão
  @Patch('questions/:id')
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async updateQuestion(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.quizzesService.updateQuestion(id, dto);
  }

  // Deletar questão
  @Delete('questions/:id')
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async deleteQuestion(@Param('id') id: string) {
    return this.quizzesService.deleteQuestion(id);
  }

  // Criar opção
  @Post('questions/:questionId/options')
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async createOption(
    @Param('questionId') questionId: string,
    @Body() dto: Omit<CreateOptionDto, 'questionId'>,
  ) {
    return this.quizzesService.createOption({
      ...dto,
      questionId,
    });
  }

  // Atualizar opção
  @Patch('options/:id')
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async updateOption(@Param('id') id: string, @Body() dto: UpdateOptionDto) {
    return this.quizzesService.updateOption(id, dto);
  }

  // Deletar opção
  @Delete('options/:id')
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async deleteOption(@Param('id') id: string) {
    return this.quizzesService.deleteOption(id);
  }

  // ============================================
  // ALUNO ENDPOINTS
  // ============================================

  // Estado do quiz para o aluno
  @Get('lessons/:lessonId/quiz-state')
  async getQuizState(
    @Param('lessonId') lessonId: string,
    @Request() req: any,
  ) {
    return this.quizzesService.getQuizState(lessonId, req.user.id);
  }

  // Iniciar tentativa de quiz
  @Post('lessons/:lessonId/quiz/start')
  async startQuizAttempt(
    @Param('lessonId') lessonId: string,
    @Request() req: any,
  ) {
    return this.quizzesService.startQuizAttempt(lessonId, req.user.id);
  }

  // Submeter respostas
  @Post('quiz/attempts/:attemptId/submit')
  async submitQuizAttempt(
    @Param('attemptId') attemptId: string,
    @Request() req: any,
    @Body() dto: SubmitQuizDto,
  ) {
    return this.quizzesService.submitQuizAttempt(attemptId, req.user.id, dto);
  }

  // Confirmar reassistência (para liberar novo ciclo)
  @Post('lessons/:lessonId/rewatch-confirm')
  async confirmRewatch(
    @Param('lessonId') lessonId: string,
    @Request() req: any,
  ) {
    return this.quizzesService.confirmRewatch(lessonId, req.user.id);
  }
}
