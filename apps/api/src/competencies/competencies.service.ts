import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompetenciesService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // CRUD DE COMPETÊNCIAS
  // ============================================

  async create(instituteId: string, data: { name: string; description?: string }) {
    return this.prisma.competency.create({
      data: {
        instituteId,
        name: data.name,
        description: data.description,
      },
    });
  }

  async findAll(instituteId: string) {
    return this.prisma.competency.findMany({
      where: { instituteId },
      include: {
        _count: {
          select: {
            lessonCompetencies: true,
            questionBank: true,
            userCompetencyStates: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const competency = await this.prisma.competency.findUnique({
      where: { id },
      include: {
        lessonCompetencies: {
          include: {
            lesson: {
              select: { id: true, title: true },
            },
          },
        },
        questionBank: {
          include: {
            question: {
              include: {
                options: true,
              },
            },
          },
        },
        _count: {
          select: {
            userCompetencyStates: true,
          },
        },
      },
    });

    if (!competency) {
      throw new NotFoundException('Competência não encontrada');
    }

    return competency;
  }

  async update(id: string, data: { name?: string; description?: string }) {
    return this.prisma.competency.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.competency.delete({
      where: { id },
    });
  }

  // ============================================
  // LIGAR COMPETÊNCIAS A AULAS
  // ============================================

  async setLessonCompetencies(lessonId: string, competencyIds: string[]) {
    // Remove todas as ligações existentes
    await this.prisma.lessonCompetency.deleteMany({
      where: { lessonId },
    });

    // Cria novas ligações
    if (competencyIds.length > 0) {
      await this.prisma.lessonCompetency.createMany({
        data: competencyIds.map((competencyId) => ({
          lessonId,
          competencyId,
        })),
      });
    }

    return this.getLessonCompetencies(lessonId);
  }

  async getLessonCompetencies(lessonId: string) {
    return this.prisma.lessonCompetency.findMany({
      where: { lessonId },
      include: {
        competency: true,
      },
    });
  }

  // ============================================
  // BANCO DE QUESTÕES
  // ============================================

  async addQuestionToBank(competencyId: string, questionId: string) {
    return this.prisma.competencyQuestionBank.create({
      data: {
        competencyId,
        questionId,
      },
      include: {
        question: {
          include: { options: true },
        },
      },
    });
  }

  async removeQuestionFromBank(competencyId: string, questionId: string) {
    return this.prisma.competencyQuestionBank.deleteMany({
      where: {
        competencyId,
        questionId,
      },
    });
  }

  async getQuestionBank(competencyId: string) {
    return this.prisma.competencyQuestionBank.findMany({
      where: { competencyId },
      include: {
        question: {
          include: { options: true },
        },
      },
    });
  }

  // ============================================
  // CRIAÇÃO DE SCHEDULES AO APROVAR AULA
  // ============================================

  async createReviewSchedulesForApproval(
    userId: string,
    lessonId: string,
    approvedAt: Date,
  ) {
    // Buscar competências ligadas à aula
    const lessonCompetencies = await this.prisma.lessonCompetency.findMany({
      where: { lessonId },
      include: { competency: true },
    });

    if (lessonCompetencies.length === 0) {
      return [];
    }

    const schedulesToCreate: Array<{
      userId: string;
      competencyId: string;
      dueAt: Date;
    }> = [];

    const reviewDays = [7, 30, 90];

    for (const lc of lessonCompetencies) {
      for (const days of reviewDays) {
        const dueAt = new Date(approvedAt);
        dueAt.setDate(dueAt.getDate() + days);

        // Verificar se já existe um schedule para esse user+competency+dueAt
        const existing = await this.prisma.competencyReviewSchedule.findFirst({
          where: {
            userId,
            competencyId: lc.competencyId,
            dueAt: {
              gte: new Date(dueAt.getTime() - 86400000), // -1 dia
              lte: new Date(dueAt.getTime() + 86400000), // +1 dia
            },
          },
        });

        if (!existing) {
          schedulesToCreate.push({
            userId,
            competencyId: lc.competencyId,
            dueAt,
          });
        }
      }

      // Criar ou atualizar UserCompetencyState como GREEN
      await this.prisma.userCompetencyState.upsert({
        where: {
          userId_competencyId: {
            userId,
            competencyId: lc.competencyId,
          },
        },
        create: {
          userId,
          competencyId: lc.competencyId,
          state: 'GREEN',
          lastReviewAt: approvedAt,
          nextDueAt: new Date(approvedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
        update: {
          state: 'GREEN',
          lastReviewAt: approvedAt,
          nextDueAt: new Date(approvedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    }

    // Criar schedules em lote
    if (schedulesToCreate.length > 0) {
      await this.prisma.competencyReviewSchedule.createMany({
        data: schedulesToCreate,
      });
    }

    return schedulesToCreate;
  }
}
