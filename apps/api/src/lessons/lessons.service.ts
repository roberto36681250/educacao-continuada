import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { ContentStatus, UserRole } from '@prisma/client';

export interface ReadinessCheckItem {
  key: string;
  label: string;
  pass: boolean;
  required: boolean;
}

export interface ReadinessReport {
  isReady: boolean;
  checklist: ReadinessCheckItem[];
  warnings: string[];
  checkedAt: string;
}

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService) {}

  async findByModule(moduleId: string, includeUnpublished = false) {
    const where: { moduleId: string; status?: ContentStatus } = { moduleId };
    if (!includeUnpublished) {
      where.status = ContentStatus.PUBLISHED;
    }

    return this.prisma.lesson.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        youtubeVideoId: true,
        durationSeconds: true,
        minWatchPercent: true,
        status: true,
        sortOrder: true,
        practicalSummary: true,
        tomorrowChecklist: true,
        createdAt: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        module: {
          select: {
            id: true,
            title: true,
            course: {
              select: {
                id: true,
                title: true,
                instituteId: true,
              },
            },
          },
        },
        quiz: {
          select: {
            id: true,
            title: true,
            minScore: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Aula não encontrada');
    }

    return lesson;
  }

  async create(dto: CreateLessonDto) {
    const maxOrder = await this.prisma.lesson.aggregate({
      where: { moduleId: dto.moduleId },
      _max: { sortOrder: true },
    });

    return this.prisma.lesson.create({
      data: {
        title: dto.title,
        description: dto.description,
        moduleId: dto.moduleId,
        youtubeVideoId: dto.youtubeVideoId,
        durationSeconds: dto.durationSeconds || 0,
        minWatchPercent: dto.minWatchPercent || 90,
        status: dto.status || ContentStatus.DRAFT,
        sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
        practicalSummary: dto.practicalSummary,
        tomorrowChecklist: dto.tomorrowChecklist,
      },
      select: {
        id: true,
        title: true,
        description: true,
        youtubeVideoId: true,
        durationSeconds: true,
        minWatchPercent: true,
        status: true,
        sortOrder: true,
        practicalSummary: true,
        tomorrowChecklist: true,
        createdAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateLessonDto) {
    const existing = await this.prisma.lesson.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Aula não encontrada');
    }

    return this.prisma.lesson.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        youtubeVideoId: dto.youtubeVideoId,
        durationSeconds: dto.durationSeconds,
        minWatchPercent: dto.minWatchPercent,
        status: dto.status,
        sortOrder: dto.sortOrder,
        practicalSummary: dto.practicalSummary,
        tomorrowChecklist: dto.tomorrowChecklist,
      },
      select: {
        id: true,
        title: true,
        description: true,
        youtubeVideoId: true,
        durationSeconds: true,
        minWatchPercent: true,
        status: true,
        sortOrder: true,
        practicalSummary: true,
        tomorrowChecklist: true,
        createdAt: true,
      },
    });
  }

  async getProgress(lessonId: string, userId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { durationSeconds: true, minWatchPercent: true },
    });

    if (!lesson) {
      throw new NotFoundException('Aula não encontrada');
    }

    const progress = await this.prisma.videoProgress.findUnique({
      where: {
        userId_lessonId: { userId, lessonId },
      },
    });

    if (!progress) {
      return {
        lessonId,
        watchedSeconds: 0,
        watchedPct: 0,
        completed: false,
        durationSeconds: lesson.durationSeconds,
        minWatchPercent: lesson.minWatchPercent,
      };
    }

    return {
      lessonId,
      watchedSeconds: progress.watchedSeconds,
      watchedPct: progress.watchedPct,
      completed: progress.completed,
      durationSeconds: lesson.durationSeconds,
      minWatchPercent: lesson.minWatchPercent,
    };
  }

  async updateProgress(lessonId: string, userId: string, dto: UpdateProgressDto) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { durationSeconds: true, minWatchPercent: true },
    });

    if (!lesson) {
      throw new NotFoundException('Aula não encontrada');
    }

    // Calcula porcentagem assistida
    const watchedPct = lesson.durationSeconds > 0
      ? Math.min(100, Math.floor((dto.watchedSeconds / lesson.durationSeconds) * 100))
      : 0;

    // Verifica se completou (atingiu o mínimo)
    const completed = watchedPct >= lesson.minWatchPercent;

    // Upsert do progresso
    const progress = await this.prisma.videoProgress.upsert({
      where: {
        userId_lessonId: { userId, lessonId },
      },
      create: {
        userId,
        lessonId,
        watchedSeconds: dto.watchedSeconds,
        watchedPct,
        completed,
        lastWatchedAt: new Date(),
      },
      update: {
        watchedSeconds: dto.watchedSeconds,
        watchedPct,
        completed,
        lastWatchedAt: new Date(),
      },
    });

    return {
      lessonId,
      watchedSeconds: progress.watchedSeconds,
      watchedPct: progress.watchedPct,
      completed: progress.completed,
      durationSeconds: lesson.durationSeconds,
      minWatchPercent: lesson.minWatchPercent,
    };
  }

  // Registrar última aula acessada para "Retomar de onde parou"
  async recordLastSeen(lessonId: string, userId: string): Promise<void> {
    await this.prisma.lessonLastSeen.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { seenAt: new Date() },
      create: { userId, lessonId },
    });
  }

  // ============================================
  // WORKFLOW EDITORIAL
  // ============================================

  /**
   * Verifica readiness de uma lesson
   */
  async getReadiness(lessonId: string): Promise<ReadinessReport> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
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
        lessonCompetencies: true,
      },
    });

    if (!lesson) {
      throw new NotFoundException('Aula não encontrada');
    }

    const checklist: ReadinessCheckItem[] = [];
    const warnings: string[] = [];

    // 1. Title preenchido
    checklist.push({
      key: 'title',
      label: 'Título preenchido',
      pass: !!lesson.title?.trim(),
      required: true,
    });

    // 2. YouTube Video ID
    checklist.push({
      key: 'youtubeVideoId',
      label: 'ID do vídeo do YouTube preenchido',
      pass: !!lesson.youtubeVideoId?.trim(),
      required: true,
    });

    // 3. Duration > 0
    checklist.push({
      key: 'durationSeconds',
      label: 'Duração do vídeo definida (> 0)',
      pass: lesson.durationSeconds > 0,
      required: true,
    });

    // 4. Practical Summary
    checklist.push({
      key: 'practicalSummary',
      label: 'Resumo prático preenchido',
      pass: !!lesson.practicalSummary?.trim(),
      required: true,
    });

    // 5. Tomorrow Checklist
    checklist.push({
      key: 'tomorrowChecklist',
      label: 'Checklist do plantão preenchido',
      pass: !!lesson.tomorrowChecklist?.trim(),
      required: true,
    });

    // 6. Quiz exists
    const hasQuiz = !!lesson.quiz;
    checklist.push({
      key: 'quizExists',
      label: 'Quiz criado para a aula',
      pass: hasQuiz,
      required: true,
    });

    // 7. Quiz minScore definido
    checklist.push({
      key: 'quizMinScore',
      label: 'Nota mínima do quiz definida',
      pass: hasQuiz && lesson.quiz!.minScore > 0,
      required: true,
    });

    // 8. Quiz tem >= 5 questions
    const questionCount = lesson.quiz?.questions?.length || 0;
    checklist.push({
      key: 'quizQuestionCount',
      label: `Quiz tem 5+ questões (atual: ${questionCount})`,
      pass: questionCount >= 5,
      required: true,
    });

    // 9. Cada question tem >= 2 options
    const allQuestionsHaveOptions = lesson.quiz?.questions?.every(q => q.options.length >= 2) || false;
    checklist.push({
      key: 'questionOptions',
      label: 'Cada questão tem 2+ opções',
      pass: hasQuiz && allQuestionsHaveOptions,
      required: true,
    });

    // 10. Cada question tem ao menos 1 option correta
    const allQuestionsHaveCorrect = lesson.quiz?.questions?.every(
      q => q.options.some(o => o.isCorrect)
    ) || false;
    checklist.push({
      key: 'questionCorrectOption',
      label: 'Cada questão tem opção correta',
      pass: hasQuiz && allQuestionsHaveCorrect,
      required: true,
    });

    // 11. Competências (opcional, gera warning)
    const hasCompetencies = lesson.lessonCompetencies.length > 0;
    checklist.push({
      key: 'competencies',
      label: 'Competências vinculadas',
      pass: hasCompetencies,
      required: false,
    });

    if (!hasCompetencies) {
      warnings.push('Recomendado vincular ao menos uma competência para melhor rastreamento');
    }

    const isReady = checklist.filter(c => c.required).every(c => c.pass);

    return {
      isReady,
      checklist,
      warnings,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Recalcula readiness e atualiza status se necessário
   */
  async recomputeReadiness(lessonId: string): Promise<ReadinessReport> {
    const report = await this.getReadiness(lessonId);

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      throw new NotFoundException('Aula não encontrada');
    }

    // Só atualiza para READY se está em DRAFT e passou no checklist
    // Não regride se já está PUBLISHED
    if (report.isReady && lesson.status === ContentStatus.DRAFT) {
      await this.prisma.lesson.update({
        where: { id: lessonId },
        data: {
          status: ContentStatus.READY,
          readyAt: new Date(),
          readinessReport: report as any,
        },
      });
    } else if (!report.isReady && lesson.status === ContentStatus.READY) {
      // Se perdeu readiness, volta para DRAFT
      await this.prisma.lesson.update({
        where: { id: lessonId },
        data: {
          status: ContentStatus.DRAFT,
          readyAt: null,
          readinessReport: report as any,
        },
      });
    } else {
      // Apenas atualiza o report
      await this.prisma.lesson.update({
        where: { id: lessonId },
        data: {
          readinessReport: report as any,
        },
      });
    }

    return report;
  }

  /**
   * Publicar lesson
   */
  async publishLesson(lessonId: string, userId: string, userRole: UserRole, allowProfessorPublish = false) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { include: { course: true } } },
    });

    if (!lesson) {
      throw new NotFoundException('Aula não encontrada');
    }

    // Verificar permissão
    const canPublish = userRole === UserRole.ADMIN_MASTER ||
                       userRole === UserRole.ADMIN ||
                       userRole === UserRole.MANAGER ||
                       (userRole === UserRole.USER && allowProfessorPublish);

    if (!canPublish) {
      throw new ForbiddenException('Sem permissão para publicar');
    }

    // Verificar se está READY
    if (lesson.status !== ContentStatus.READY) {
      throw new BadRequestException('Aula deve estar com status READY para ser publicada. Execute o checklist primeiro.');
    }

    // Publicar
    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: { status: ContentStatus.PUBLISHED },
    });

    // Registrar auditoria
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'LESSON_PUBLISHED',
        entity: 'Lesson',
        entityId: lessonId,
        metadata: {
          title: lesson.title,
          moduleId: lesson.moduleId,
          courseId: lesson.module.courseId,
        },
      },
    });

    return { success: true, message: 'Aula publicada com sucesso' };
  }

  /**
   * Duplicar lesson
   */
  async duplicateLesson(lessonId: string, targetModuleId: string, newTitle: string | undefined, userId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
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
        lessonCompetencies: true,
      },
    });

    if (!lesson) {
      throw new NotFoundException('Aula não encontrada');
    }

    // Verificar se módulo destino existe
    const targetModule = await this.prisma.module.findUnique({
      where: { id: targetModuleId },
    });

    if (!targetModule) {
      throw new NotFoundException('Módulo de destino não encontrado');
    }

    // Próximo sortOrder no módulo destino
    const maxOrder = await this.prisma.lesson.aggregate({
      where: { moduleId: targetModuleId },
      _max: { sortOrder: true },
    });

    // Criar nova lesson
    const newLesson = await this.prisma.lesson.create({
      data: {
        title: newTitle || `${lesson.title} (cópia)`,
        description: lesson.description,
        moduleId: targetModuleId,
        youtubeVideoId: lesson.youtubeVideoId,
        durationSeconds: lesson.durationSeconds,
        minWatchPercent: lesson.minWatchPercent,
        practicalSummary: lesson.practicalSummary,
        tomorrowChecklist: lesson.tomorrowChecklist,
        status: ContentStatus.DRAFT,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });

    // Copiar quiz se existir
    if (lesson.quiz) {
      const newQuiz = await this.prisma.quiz.create({
        data: {
          lessonId: newLesson.id,
          title: lesson.quiz.title,
          minScore: lesson.quiz.minScore,
        },
      });

      // Copiar questions e options
      for (const question of lesson.quiz.questions) {
        const newQuestion = await this.prisma.question.create({
          data: {
            quizId: newQuiz.id,
            text: question.text,
            type: question.type,
            sortOrder: question.sortOrder,
          },
        });

        // Copiar options
        for (const option of question.options) {
          await this.prisma.option.create({
            data: {
              questionId: newQuestion.id,
              text: option.text,
              isCorrect: option.isCorrect,
              sortOrder: option.sortOrder,
            },
          });
        }
      }
    }

    // Copiar competências
    for (const lc of lesson.lessonCompetencies) {
      await this.prisma.lessonCompetency.create({
        data: {
          lessonId: newLesson.id,
          competencyId: lc.competencyId,
        },
      });
    }

    // Registrar auditoria
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'LESSON_DUPLICATED',
        entity: 'Lesson',
        entityId: newLesson.id,
        metadata: {
          originalLessonId: lessonId,
          originalTitle: lesson.title,
          newTitle: newLesson.title,
          targetModuleId,
        },
      },
    });

    return { newLessonId: newLesson.id, title: newLesson.title };
  }

  /**
   * Criar lessons em lote
   */
  async createBulk(moduleId: string, titles: string[], userId: string) {
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new NotFoundException('Módulo não encontrado');
    }

    // Próximo sortOrder
    const maxOrder = await this.prisma.lesson.aggregate({
      where: { moduleId },
      _max: { sortOrder: true },
    });

    let currentOrder = (maxOrder._max.sortOrder ?? 0) + 1;
    const createdIds: string[] = [];

    for (const title of titles) {
      const lesson = await this.prisma.lesson.create({
        data: {
          title: title || `Aula ${currentOrder}`,
          moduleId,
          status: ContentStatus.DRAFT,
          sortOrder: currentOrder,
        },
      });
      createdIds.push(lesson.id);
      currentOrder++;
    }

    // Registrar auditoria
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'LESSON_BULK_CREATED',
        entity: 'Module',
        entityId: moduleId,
        metadata: {
          count: titles.length,
          lessonIds: createdIds,
        },
      },
    });

    return { createdIds, count: createdIds.length };
  }

  // ============================================
  // LOCK DE EDIÇÃO
  // ============================================

  /**
   * Obter lock atual
   */
  async getLock(lessonId: string) {
    const lock = await this.prisma.lessonEditLock.findUnique({
      where: { lessonId },
    });

    if (!lock) {
      return { locked: false };
    }

    // Verificar se expirou
    if (new Date() > lock.expiresAt) {
      await this.prisma.lessonEditLock.delete({
        where: { id: lock.id },
      });
      return { locked: false };
    }

    // Buscar nome do usuário
    const user = await this.prisma.user.findUnique({
      where: { id: lock.lockedByUserId },
      select: { name: true },
    });

    return {
      locked: true,
      lockedBy: lock.lockedByUserId,
      lockedByName: user?.name || 'Usuário',
      lockedAt: lock.lockedAt,
      expiresAt: lock.expiresAt,
    };
  }

  /**
   * Adquirir ou renovar lock (10 minutos)
   */
  async acquireLock(lessonId: string, userId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      throw new NotFoundException('Aula não encontrada');
    }

    const existingLock = await this.prisma.lessonEditLock.findUnique({
      where: { lessonId },
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutos

    if (existingLock) {
      // Se o lock é do mesmo usuário ou expirou, renovar
      if (existingLock.lockedByUserId === userId || now > existingLock.expiresAt) {
        await this.prisma.lessonEditLock.update({
          where: { id: existingLock.id },
          data: {
            lockedByUserId: userId,
            lockedAt: now,
            expiresAt,
          },
        });
        return { success: true, expiresAt };
      } else {
        // Lock pertence a outro usuário e não expirou
        const user = await this.prisma.user.findUnique({
          where: { id: existingLock.lockedByUserId },
          select: { name: true },
        });
        throw new ForbiddenException(
          `Aula sendo editada por ${user?.name || 'outro usuário'}. Tente novamente após ${existingLock.expiresAt.toLocaleTimeString('pt-BR')}.`
        );
      }
    }

    // Criar novo lock
    await this.prisma.lessonEditLock.create({
      data: {
        lessonId,
        lockedByUserId: userId,
        expiresAt,
      },
    });

    return { success: true, expiresAt };
  }

  /**
   * Liberar lock
   */
  async releaseLock(lessonId: string, userId: string) {
    const lock = await this.prisma.lessonEditLock.findUnique({
      where: { lessonId },
    });

    if (!lock) {
      return { success: true };
    }

    // Só pode liberar se for o dono do lock
    if (lock.lockedByUserId !== userId) {
      throw new ForbiddenException('Você não pode liberar o lock de outro usuário');
    }

    await this.prisma.lessonEditLock.delete({
      where: { id: lock.id },
    });

    return { success: true };
  }
}
