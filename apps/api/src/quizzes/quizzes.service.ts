import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompetenciesService } from '../competencies/competencies.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { CreateQuestionDto, UpdateQuestionDto } from './dto/create-question.dto';
import { CreateOptionDto, UpdateOptionDto } from './dto/create-option.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

@Injectable()
export class QuizzesService {
  constructor(
    private prisma: PrismaService,
    private competenciesService: CompetenciesService,
  ) {}

  // ============================================
  // CRUD QUIZ
  // ============================================

  async createOrUpdateQuiz(dto: CreateQuizDto) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: dto.lessonId },
    });
    if (!lesson) {
      throw new NotFoundException('Aula não encontrada');
    }

    return this.prisma.quiz.upsert({
      where: { lessonId: dto.lessonId },
      create: {
        lessonId: dto.lessonId,
        title: dto.title,
        minScore: dto.minScore ?? 70,
      },
      update: {
        title: dto.title,
        minScore: dto.minScore,
      },
    });
  }

  async getQuizByLesson(lessonId: string) {
    return this.prisma.quiz.findUnique({
      where: { lessonId },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
  }

  // ============================================
  // CRUD QUESTIONS
  // ============================================

  async createQuestion(dto: CreateQuestionDto) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: dto.quizId },
    });
    if (!quiz) {
      throw new NotFoundException('Quiz não encontrado');
    }

    // Auto sortOrder
    const lastQuestion = await this.prisma.question.findFirst({
      where: { quizId: dto.quizId },
      orderBy: { sortOrder: 'desc' },
    });
    const sortOrder = dto.sortOrder ?? (lastQuestion?.sortOrder ?? 0) + 1;

    return this.prisma.question.create({
      data: {
        quizId: dto.quizId,
        text: dto.text,
        type: dto.type,
        justificationRequired: dto.justificationRequired,
        sortOrder,
      },
      include: {
        options: true,
      },
    });
  }

  async updateQuestion(id: string, dto: UpdateQuestionDto) {
    const question = await this.prisma.question.findUnique({
      where: { id },
    });
    if (!question) {
      throw new NotFoundException('Questão não encontrada');
    }

    return this.prisma.question.update({
      where: { id },
      data: dto,
      include: {
        options: true,
      },
    });
  }

  async deleteQuestion(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
    });
    if (!question) {
      throw new NotFoundException('Questão não encontrada');
    }

    return this.prisma.question.delete({
      where: { id },
    });
  }

  async getQuestionsByLesson(lessonId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { lessonId },
    });
    if (!quiz) {
      return [];
    }

    return this.prisma.question.findMany({
      where: { quizId: quiz.id },
      orderBy: { sortOrder: 'asc' },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  // ============================================
  // CRUD OPTIONS
  // ============================================

  async createOption(dto: CreateOptionDto) {
    const question = await this.prisma.question.findUnique({
      where: { id: dto.questionId },
    });
    if (!question) {
      throw new NotFoundException('Questão não encontrada');
    }

    // Auto sortOrder
    const lastOption = await this.prisma.option.findFirst({
      where: { questionId: dto.questionId },
      orderBy: { sortOrder: 'desc' },
    });
    const sortOrder = dto.sortOrder ?? (lastOption?.sortOrder ?? 0) + 1;

    return this.prisma.option.create({
      data: {
        questionId: dto.questionId,
        text: dto.text,
        isCorrect: dto.isCorrect,
        sortOrder,
      },
    });
  }

  async updateOption(id: string, dto: UpdateOptionDto) {
    const option = await this.prisma.option.findUnique({
      where: { id },
    });
    if (!option) {
      throw new NotFoundException('Opção não encontrada');
    }

    return this.prisma.option.update({
      where: { id },
      data: dto,
    });
  }

  async deleteOption(id: string) {
    const option = await this.prisma.option.findUnique({
      where: { id },
    });
    if (!option) {
      throw new NotFoundException('Opção não encontrada');
    }

    return this.prisma.option.delete({
      where: { id },
    });
  }

  // ============================================
  // QUIZ STATE (para aluno)
  // ============================================

  async getQuizState(lessonId: string, userId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { lessonId },
    });

    // Verificar progresso do vídeo
    const videoProgress = await this.prisma.videoProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });

    // Verificar se já está aprovado
    const approval = await this.prisma.lessonApproval.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });

    // Buscar tentativas do usuário para esta aula
    const attempts = await this.prisma.quizAttempt.findMany({
      where: {
        userId,
        lessonId,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Determinar ciclo atual e tentativas usadas
    const latestAttempt = attempts[0];
    let currentCycleNumber = latestAttempt?.cycleNumber ?? 1;

    // Se o último status foi REQUIRES_REWATCH mas o vídeo foi completado novamente,
    // significa que estamos em um novo ciclo
    const wasRequiresRewatch = latestAttempt?.status === 'REQUIRES_REWATCH';
    const videoCompleted = videoProgress?.completed ?? false;

    if (wasRequiresRewatch && videoCompleted) {
      // Novo ciclo disponível após reassistir
      currentCycleNumber = currentCycleNumber + 1;
    }

    // Contar tentativas no ciclo atual
    const attemptsInCurrentCycle = attempts.filter(
      (a) => a.cycleNumber === currentCycleNumber
    );
    const attemptsUsedInCycle = attemptsInCurrentCycle.length;

    // Está bloqueado APENAS se REQUIRES_REWATCH e vídeo NÃO foi completado novamente
    const isBlocked = wasRequiresRewatch && !videoCompleted;

    // Verificar se tem tentativa em progresso
    const inProgressAttempt = attempts.find((a) => a.status === 'IN_PROGRESS');

    return {
      hasQuiz: !!quiz,
      quizId: quiz?.id ?? null,
      minScore: quiz?.minScore ?? 70,
      completedVideo: videoProgress?.completed ?? false,
      approved: !!approval,
      approvalScore: approval?.score ?? null,
      isBlocked,
      currentCycleNumber,
      attemptsUsedInCycle,
      maxAttempts: 3,
      inProgressAttemptId: inProgressAttempt?.id ?? null,
      lastAttempts: attemptsInCurrentCycle.map((a) => ({
        id: a.id,
        attemptNumber: a.attemptNumber,
        score: a.score,
        status: a.status,
        finishedAt: a.finishedAt,
      })),
    };
  }

  // ============================================
  // START QUIZ ATTEMPT
  // ============================================

  async startQuizAttempt(lessonId: string, userId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { lessonId },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz não encontrado para esta aula');
    }

    if (quiz.questions.length === 0) {
      throw new BadRequestException('Quiz não possui questões');
    }

    // Verificar se vídeo foi completado
    const videoProgress = await this.prisma.videoProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });

    if (!videoProgress?.completed) {
      throw new ForbiddenException('Você precisa completar o vídeo antes de fazer o quiz');
    }

    // Verificar se já está aprovado
    const approval = await this.prisma.lessonApproval.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });

    if (approval) {
      throw new BadRequestException('Você já foi aprovado nesta aula');
    }

    // Verificar tentativas anteriores
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { userId, lessonId },
      orderBy: { createdAt: 'desc' },
    });

    const latestAttempt = attempts[0];

    // Verificar se está bloqueado
    // Se estava REQUIRES_REWATCH mas vídeo foi reassistido (completed = true), liberar novo ciclo
    if (latestAttempt?.status === 'REQUIRES_REWATCH') {
      if (!videoProgress?.completed) {
        throw new ForbiddenException('Você precisa reassistir a aula antes de tentar novamente');
      }
      // Video foi reassistido, vamos criar tentativa no novo ciclo
    }

    // Verificar se já tem tentativa em progresso
    const inProgressAttempt = attempts.find((a) => a.status === 'IN_PROGRESS');
    if (inProgressAttempt) {
      // Retornar tentativa existente
      return {
        attemptId: inProgressAttempt.id,
        questions: quiz.questions.map((q) => ({
          id: q.id,
          text: q.text,
          type: q.type,
          justificationRequired: q.justificationRequired,
          options: q.options.map((o) => ({
            id: o.id,
            text: o.text,
          })),
        })),
      };
    }

    // Calcular ciclo e número da tentativa
    let currentCycleNumber = latestAttempt?.cycleNumber ?? 1;

    // Se a última tentativa foi REQUIRES_REWATCH e vídeo está completed,
    // significa que o usuário reassistiu - iniciar novo ciclo
    if (latestAttempt?.status === 'REQUIRES_REWATCH' && videoProgress?.completed) {
      currentCycleNumber = latestAttempt.cycleNumber + 1;
    }

    const attemptsInCycle = attempts.filter((a) => a.cycleNumber === currentCycleNumber);
    const attemptNumber = attemptsInCycle.length + 1;

    if (attemptNumber > 3) {
      throw new ForbiddenException('Você esgotou as 3 tentativas. Reassista a aula para um novo ciclo.');
    }

    // Criar nova tentativa
    const newAttempt = await this.prisma.quizAttempt.create({
      data: {
        userId,
        quizId: quiz.id,
        lessonId,
        attemptNumber,
        cycleNumber: currentCycleNumber,
        status: 'IN_PROGRESS',
      },
    });

    return {
      attemptId: newAttempt.id,
      questions: quiz.questions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        justificationRequired: q.justificationRequired,
        options: q.options.map((o) => ({
          id: o.id,
          text: o.text,
        })),
      })),
    };
  }

  // ============================================
  // SUBMIT QUIZ ATTEMPT
  // ============================================

  async submitQuizAttempt(attemptId: string, userId: string, dto: SubmitQuizDto) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          include: {
            questions: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException('Tentativa não encontrada');
    }

    if (attempt.userId !== userId) {
      throw new ForbiddenException('Esta tentativa não pertence a você');
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Esta tentativa já foi finalizada');
    }

    const { quiz } = attempt;
    const questions = quiz.questions;
    let correctCount = 0;

    // Processar cada resposta
    const answersData = dto.answers.map((answer) => {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) {
        throw new BadRequestException(`Questão ${answer.questionId} não encontrada`);
      }

      // Verificar se a resposta está correta
      const correctOptionIds = question.options
        .filter((o) => o.isCorrect)
        .map((o) => o.id)
        .sort();

      const selectedIds = [...answer.selectedOptionIds].sort();

      // Para MULTIPLE_CHOICE e CASE: apenas uma opção correta
      // Para MULTIPLE_SELECT: todas as corretas devem ser selecionadas
      const isCorrect =
        correctOptionIds.length === selectedIds.length &&
        correctOptionIds.every((id, i) => id === selectedIds[i]);

      if (isCorrect) {
        correctCount++;
      }

      return {
        attemptId,
        questionId: answer.questionId,
        selectedOptionIds: answer.selectedOptionIds,
        justificationText: answer.justificationText,
        isCorrect,
      };
    });

    // Calcular score
    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= quiz.minScore;

    // Determinar status
    let status: 'PASSED' | 'FAILED' | 'REQUIRES_REWATCH';
    if (passed) {
      status = 'PASSED';
    } else if (attempt.attemptNumber >= 3) {
      status = 'REQUIRES_REWATCH';
    } else {
      status = 'FAILED';
    }

    // Salvar respostas e atualizar tentativa
    await this.prisma.$transaction(async (tx) => {
      // Criar respostas
      await tx.questionAnswer.createMany({
        data: answersData,
      });

      // Atualizar tentativa
      await tx.quizAttempt.update({
        where: { id: attemptId },
        data: {
          score,
          status,
          finishedAt: new Date(),
        },
      });

      // Se passou, criar aprovação
      if (passed) {
        // Verificar se já existe aprovação (não deve criar schedules duplicados)
        const existingApproval = await tx.lessonApproval.findUnique({
          where: { userId_lessonId: { userId, lessonId: attempt.lessonId } },
        });

        if (!existingApproval) {
          await tx.lessonApproval.create({
            data: {
              userId,
              lessonId: attempt.lessonId,
              quizAttemptId: attemptId,
              score,
              cycleNumber: attempt.cycleNumber,
            },
          });
        }
      }

      // Se REQUIRES_REWATCH, resetar progresso do vídeo
      if (status === 'REQUIRES_REWATCH') {
        await tx.videoProgress.update({
          where: { userId_lessonId: { userId, lessonId: attempt.lessonId } },
          data: {
            watchedSeconds: 0,
            watchedPct: 0,
            completed: false,
          },
        });
      }
    });

    // Criar schedules de revisão de competências (fora da transaction)
    if (passed) {
      try {
        await this.competenciesService.createReviewSchedulesForApproval(
          userId,
          attempt.lessonId,
          new Date(),
        );
      } catch (error) {
        // Log but don't fail - schedules can be created later
        console.error('Failed to create competency review schedules:', error);
      }
    }

    return {
      attemptId,
      score,
      minScore: quiz.minScore,
      passed,
      status,
      correctCount,
      totalQuestions: questions.length,
      message: passed
        ? 'Parabéns! Você foi aprovado!'
        : status === 'REQUIRES_REWATCH'
        ? 'Você esgotou as 3 tentativas. Reassista a aula para tentar novamente.'
        : `Você acertou ${correctCount} de ${questions.length}. Tente novamente!`,
    };
  }

  // ============================================
  // REWATCH CONFIRM
  // ============================================

  async confirmRewatch(lessonId: string, userId: string) {
    // Verificar se o usuário está em estado REQUIRES_REWATCH
    const latestAttempt = await this.prisma.quizAttempt.findFirst({
      where: { userId, lessonId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestAttempt || latestAttempt.status !== 'REQUIRES_REWATCH') {
      throw new BadRequestException('Você não está em estado de reassistir obrigatório');
    }

    // Verificar se vídeo foi completado novamente
    const videoProgress = await this.prisma.videoProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });

    if (!videoProgress?.completed) {
      throw new ForbiddenException('Você precisa completar o vídeo novamente para liberar novo ciclo');
    }

    // Incrementar ciclo - não precisa criar nada aqui, o próximo startQuizAttempt
    // vai detectar que o ciclo mudou baseado no status REQUIRES_REWATCH e video completed

    // Na verdade, precisamos criar uma forma de saber que o ciclo foi incrementado.
    // Solução: criar uma tentativa "fantasma" que marca o novo ciclo, ou atualizar a última tentativa.
    // Melhor: o startQuizAttempt vai checar: se status = REQUIRES_REWATCH mas video completed = true,
    // então incrementa o ciclo automaticamente.

    return {
      success: true,
      message: 'Novo ciclo de tentativas liberado! Você pode fazer o quiz novamente.',
      newCycleNumber: latestAttempt.cycleNumber + 1,
    };
  }

  // ============================================
  // HELPER: Check if should unlock new cycle
  // ============================================

  async checkAndUnlockNewCycle(lessonId: string, userId: string): Promise<boolean> {
    const latestAttempt = await this.prisma.quizAttempt.findFirst({
      where: { userId, lessonId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestAttempt || latestAttempt.status !== 'REQUIRES_REWATCH') {
      return false;
    }

    const videoProgress = await this.prisma.videoProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });

    if (videoProgress?.completed) {
      // Criar uma tentativa marcadora de novo ciclo (será substituída pela real)
      // Na verdade, melhor deixar o startQuizAttempt lidar com isso
      return true;
    }

    return false;
  }
}
