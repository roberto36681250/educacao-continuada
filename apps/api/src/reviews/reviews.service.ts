import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompetencyState, ReviewScheduleStatus } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // ALUNO: MINHAS REVISÕES
  // ============================================

  async getMyReviews(userId: string) {
    const now = new Date();

    // Atualizar schedules que passaram da data para OVERDUE
    await this.prisma.competencyReviewSchedule.updateMany({
      where: {
        userId,
        status: 'DUE',
        dueAt: { lt: now },
      },
      data: { status: 'OVERDUE' },
    });

    // Buscar schedules DUE e OVERDUE
    const reviews = await this.prisma.competencyReviewSchedule.findMany({
      where: {
        userId,
        status: { in: ['DUE', 'OVERDUE'] },
      },
      include: {
        competency: true,
      },
      orderBy: { dueAt: 'asc' },
    });

    // Verificar degradação por atraso (mais de 7 dias)
    await this.checkAndDegradeOverdue(userId);

    return reviews;
  }

  async getMyCompetencies(userId: string) {
    const states = await this.prisma.userCompetencyState.findMany({
      where: { userId },
      include: {
        competency: true,
      },
      orderBy: { competency: { name: 'asc' } },
    });

    return states;
  }

  // ============================================
  // EXECUTAR REVISÃO
  // ============================================

  async startReview(scheduleId: string, userId: string) {
    const schedule = await this.prisma.competencyReviewSchedule.findUnique({
      where: { id: scheduleId },
      include: { competency: true },
    });

    if (!schedule) {
      throw new NotFoundException('Revisão não encontrada');
    }

    if (schedule.userId !== userId) {
      throw new BadRequestException('Esta revisão não pertence a você');
    }

    if (schedule.status === 'DONE') {
      throw new BadRequestException('Esta revisão já foi concluída');
    }

    // Buscar 3-5 questões aleatórias do banco
    const questionBank = await this.prisma.competencyQuestionBank.findMany({
      where: { competencyId: schedule.competencyId },
      include: {
        question: {
          include: {
            options: {
              select: { id: true, text: true, sortOrder: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (questionBank.length === 0) {
      throw new BadRequestException(
        'Não há questões cadastradas para esta competência',
      );
    }

    // Embaralhar e pegar 3-5 questões
    const shuffled = questionBank.sort(() => Math.random() - 0.5);
    const count = Math.min(5, Math.max(3, shuffled.length));
    const selectedQuestions = shuffled.slice(0, count);

    return {
      scheduleId: schedule.id,
      competency: {
        id: schedule.competency.id,
        name: schedule.competency.name,
      },
      questions: selectedQuestions.map((q) => ({
        id: q.question.id,
        text: q.question.text,
        type: q.question.type,
        options: q.question.options,
      })),
    };
  }

  async submitReview(
    scheduleId: string,
    userId: string,
    answers: Array<{ questionId: string; selectedOptionIds: string[] }>,
  ) {
    const schedule = await this.prisma.competencyReviewSchedule.findUnique({
      where: { id: scheduleId },
      include: { competency: true },
    });

    if (!schedule) {
      throw new NotFoundException('Revisão não encontrada');
    }

    if (schedule.userId !== userId) {
      throw new BadRequestException('Esta revisão não pertence a você');
    }

    if (schedule.status === 'DONE') {
      throw new BadRequestException('Esta revisão já foi concluída');
    }

    // Calcular score
    let correctCount = 0;

    for (const answer of answers) {
      const question = await this.prisma.question.findUnique({
        where: { id: answer.questionId },
        include: { options: true },
      });

      if (!question) continue;

      const correctOptionIds = question.options
        .filter((o) => o.isCorrect)
        .map((o) => o.id)
        .sort();

      const selectedIds = [...answer.selectedOptionIds].sort();

      if (
        correctOptionIds.length === selectedIds.length &&
        correctOptionIds.every((id, i) => id === selectedIds[i])
      ) {
        correctCount++;
      }
    }

    const score = Math.round((correctCount / answers.length) * 100);

    // Determinar novo estado
    let newState: CompetencyState;
    if (score >= 80) {
      newState = 'GREEN';
    } else if (score >= 60) {
      newState = 'YELLOW';
    } else if (score >= 40) {
      newState = 'ORANGE';
    } else {
      newState = 'RED';
    }

    const now = new Date();

    // Marcar schedule como DONE
    await this.prisma.competencyReviewSchedule.update({
      where: { id: scheduleId },
      data: {
        status: 'DONE',
        doneAt: now,
        score,
      },
    });

    // Buscar próximo schedule DUE para esta competência
    const nextSchedule = await this.prisma.competencyReviewSchedule.findFirst({
      where: {
        userId,
        competencyId: schedule.competencyId,
        status: { in: ['DUE', 'OVERDUE'] },
        id: { not: scheduleId },
      },
      orderBy: { dueAt: 'asc' },
    });

    // Atualizar estado da competência
    await this.prisma.userCompetencyState.upsert({
      where: {
        userId_competencyId: {
          userId,
          competencyId: schedule.competencyId,
        },
      },
      create: {
        userId,
        competencyId: schedule.competencyId,
        state: newState,
        lastReviewAt: now,
        nextDueAt: nextSchedule?.dueAt || null,
      },
      update: {
        state: newState,
        lastReviewAt: now,
        nextDueAt: nextSchedule?.dueAt || null,
      },
    });

    // Registrar no AuditLog
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'REVIEW_COMPLETED',
        entity: 'CompetencyReviewSchedule',
        entityId: scheduleId,
        metadata: {
          competencyId: schedule.competencyId,
          competencyName: schedule.competency.name,
          score,
          newState,
          correctCount,
          totalQuestions: answers.length,
        },
      },
    });

    return {
      scheduleId,
      score,
      correctCount,
      totalQuestions: answers.length,
      newState,
      message:
        score >= 80
          ? 'Excelente! Competência mantida em verde.'
          : score >= 60
            ? 'Bom, mas há espaço para melhorar.'
            : score >= 40
              ? 'Atenção: sua competência precisa de reforço.'
              : 'Alerta: revise o conteúdo e refaça a avaliação.',
    };
  }

  // ============================================
  // VERIFICAR E DEGRADAR POR ATRASO
  // ============================================

  private async checkAndDegradeOverdue(userId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Buscar schedules OVERDUE há mais de 7 dias
    const overdueSchedules =
      await this.prisma.competencyReviewSchedule.findMany({
        where: {
          userId,
          status: 'OVERDUE',
          dueAt: { lt: sevenDaysAgo },
        },
        include: { competency: true },
      });

    for (const schedule of overdueSchedules) {
      // Buscar estado atual
      const currentState = await this.prisma.userCompetencyState.findUnique({
        where: {
          userId_competencyId: {
            userId,
            competencyId: schedule.competencyId,
          },
        },
      });

      if (!currentState || currentState.state === 'RED') continue;

      // Determinar novo estado (degradar um nível)
      const stateOrder: CompetencyState[] = [
        'GREEN',
        'YELLOW',
        'ORANGE',
        'RED',
      ];
      const currentIndex = stateOrder.indexOf(currentState.state);
      const newState = stateOrder[Math.min(currentIndex + 1, 3)];

      if (newState !== currentState.state) {
        // Atualizar estado
        await this.prisma.userCompetencyState.update({
          where: { id: currentState.id },
          data: { state: newState },
        });

        // Registrar no AuditLog
        await this.prisma.auditLog.create({
          data: {
            userId,
            action: 'COMPETENCY_DEGRADED',
            entity: 'UserCompetencyState',
            entityId: currentState.id,
            metadata: {
              competencyId: schedule.competencyId,
              competencyName: schedule.competency.name,
              previousState: currentState.state,
              newState,
              reason: 'Revisão atrasada há mais de 7 dias',
            },
          },
        });
      }
    }
  }

  // ============================================
  // MAPA DE RISCO (GESTOR)
  // ============================================

  async getRiskMap(
    instituteId: string,
    groupBy: 'UNIT' | 'PROFESSION' | 'UNIT_PROFESSION',
  ) {
    // Buscar todos os estados de competência dos usuários do instituto
    const states = await this.prisma.userCompetencyState.findMany({
      where: {
        user: { instituteId },
      },
      include: {
        user: {
          select: {
            id: true,
            profession: true,
            unitAssignments: {
              where: { endAt: null },
              include: {
                unit: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
        competency: true,
      },
    });

    // Contar schedules OVERDUE
    const overdueCount = await this.prisma.competencyReviewSchedule.groupBy({
      by: ['userId'],
      where: {
        user: { instituteId },
        status: 'OVERDUE',
      },
      _count: true,
    });

    const overdueByUser = new Map(
      overdueCount.map((o) => [o.userId, o._count]),
    );

    // Agrupar dados
    const groups = new Map<
      string,
      {
        name: string;
        GREEN: number;
        YELLOW: number;
        ORANGE: number;
        RED: number;
        overdue: number;
        total: number;
      }
    >();

    for (const state of states) {
      let groupKey: string;
      let groupName: string;

      const unit = state.user.unitAssignments[0]?.unit;
      const profession = state.user.profession;

      if (groupBy === 'UNIT') {
        groupKey = unit?.id || 'sem-unidade';
        groupName = unit?.name || 'Sem Unidade';
      } else if (groupBy === 'PROFESSION') {
        groupKey = profession;
        groupName = profession;
      } else {
        groupKey = `${unit?.id || 'sem-unidade'}-${profession}`;
        groupName = `${unit?.name || 'Sem Unidade'} / ${profession}`;
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          name: groupName,
          GREEN: 0,
          YELLOW: 0,
          ORANGE: 0,
          RED: 0,
          overdue: 0,
          total: 0,
        });
      }

      const group = groups.get(groupKey)!;
      group[state.state]++;
      group.total++;

      // Adicionar overdue uma vez por usuário por grupo
      const userOverdue = overdueByUser.get(state.user.id) || 0;
      if (userOverdue > 0) {
        group.overdue = Math.max(group.overdue, userOverdue);
      }
    }

    return Array.from(groups.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  async exportRiskMapCSV(
    instituteId: string,
    groupBy: 'UNIT' | 'PROFESSION' | 'UNIT_PROFESSION',
  ) {
    const data = await this.getRiskMap(instituteId, groupBy);

    const header = 'Grupo,Verde,Amarelo,Laranja,Vermelho,Atrasados,Total\n';
    const rows = data
      .map(
        (g) =>
          `"${g.name}",${g.GREEN},${g.YELLOW},${g.ORANGE},${g.RED},${g.overdue},${g.total}`,
      )
      .join('\n');

    return header + rows;
  }
}
