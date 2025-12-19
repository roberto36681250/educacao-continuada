import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssignmentDto, ScopeType } from './dto/create-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // GESTOR: Criar atribuição
  // ============================================

  async createAssignment(dto: CreateAssignmentDto, creatorId: string, instituteId: string) {
    // Validar que o curso existe e pertence ao instituto
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      include: {
        modules: {
          include: {
            lessons: true,
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Curso não encontrado');
    }

    if (course.instituteId !== instituteId) {
      throw new ForbiddenException('Curso não pertence ao seu instituto');
    }

    // Validar que o curso tem aulas (regra: curso sem aulas não é elegível)
    const totalLessons = course.modules.reduce(
      (acc, m) => acc + m.lessons.length,
      0
    );
    if (totalLessons === 0) {
      throw new BadRequestException(
        'Curso não possui aulas. Não é elegível para atribuição.'
      );
    }

    // Validar scopes
    for (const scope of dto.scopes) {
      // INSTITUTE_ALL: não precisa de campos adicionais
      if (scope.scopeType === ScopeType.INSTITUTE_ALL) {
        // Válido - aplica a todos os usuários do instituto
      }

      // HOSPITAL_ALL: requer hospitalId
      if (scope.scopeType === ScopeType.HOSPITAL_ALL) {
        if (!scope.hospitalId) {
          throw new BadRequestException(
            'hospitalId é obrigatório para scopeType HOSPITAL_ALL'
          );
        }
        // Verificar se hospital existe e pertence ao instituto
        const hospital = await this.prisma.hospital.findUnique({
          where: { id: scope.hospitalId },
        });
        if (!hospital || hospital.instituteId !== instituteId) {
          throw new BadRequestException('Hospital inválido ou não pertence ao instituto');
        }
      }

      // UNIT_ALL e UNIT_PROFESSION: requerem unitId
      if (
        scope.scopeType === ScopeType.UNIT_ALL ||
        scope.scopeType === ScopeType.UNIT_PROFESSION
      ) {
        if (!scope.unitId) {
          throw new BadRequestException(
            `unitId é obrigatório para scopeType ${scope.scopeType}`
          );
        }
        // Verificar se unidade existe e pertence ao instituto
        const unit = await this.prisma.unit.findUnique({
          where: { id: scope.unitId },
          include: { hospital: true },
        });
        if (!unit || unit.hospital.instituteId !== instituteId) {
          throw new BadRequestException('Unidade inválida ou não pertence ao instituto');
        }
      }

      // INSTITUTE_PROFESSION e UNIT_PROFESSION: requerem profession
      if (
        scope.scopeType === ScopeType.INSTITUTE_PROFESSION ||
        scope.scopeType === ScopeType.UNIT_PROFESSION
      ) {
        if (!scope.profession) {
          throw new BadRequestException(
            `profession é obrigatório para scopeType ${scope.scopeType}`
          );
        }
      }

      // INDIVIDUAL: requer userIds
      if (scope.scopeType === ScopeType.INDIVIDUAL) {
        if (!scope.userIds || scope.userIds.length === 0) {
          throw new BadRequestException(
            'userIds é obrigatório para scopeType INDIVIDUAL'
          );
        }
        // Verificar se todos os usuários existem e pertencem ao instituto
        const users = await this.prisma.user.findMany({
          where: { id: { in: scope.userIds } },
          select: { id: true, instituteId: true },
        });
        if (users.length !== scope.userIds.length) {
          throw new BadRequestException('Um ou mais usuários não encontrados');
        }
        const invalidUsers = users.filter((u) => u.instituteId !== instituteId);
        if (invalidUsers.length > 0) {
          throw new BadRequestException('Um ou mais usuários não pertencem ao instituto');
        }
      }
    }

    // Criar assignment com scopes
    return this.prisma.assignment.create({
      data: {
        instituteId,
        courseId: dto.courseId,
        title: dto.title,
        startAt: new Date(dto.startAt),
        dueAt: new Date(dto.dueAt),
        createdByUserId: creatorId,
        scopes: {
          create: dto.scopes.map((s) => ({
            scopeType: s.scopeType,
            unitId: s.unitId,
            hospitalId: s.hospitalId,
            profession: s.profession,
            userIds: s.userIds,
          })),
        },
      },
      include: {
        scopes: true,
        course: { select: { id: true, title: true } },
      },
    });
  }

  // ============================================
  // GESTOR: Listar atribuições
  // ============================================

  async listAssignments(
    instituteId: string,
    filters?: { courseId?: string; from?: string; to?: string }
  ) {
    const where: any = { instituteId };

    if (filters?.courseId) {
      where.courseId = filters.courseId;
    }

    if (filters?.from || filters?.to) {
      where.dueAt = {};
      if (filters.from) where.dueAt.gte = new Date(filters.from);
      if (filters.to) where.dueAt.lte = new Date(filters.to);
    }

    return this.prisma.assignment.findMany({
      where,
      include: {
        scopes: true,
        course: { select: { id: true, title: true } },
        _count: { select: { statuses: true } },
      },
      orderBy: { dueAt: 'desc' },
    });
  }

  // ============================================
  // GESTOR: Detalhes de atribuição com métricas
  // ============================================

  async getAssignmentDetails(assignmentId: string, instituteId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        scopes: true,
        course: {
          select: {
            id: true,
            title: true,
            modules: {
              select: {
                lessons: { select: { id: true } },
              },
            },
          },
        },
        statuses: {
          include: {
            user: { select: { id: true, name: true, profession: true } },
          },
        },
      },
    });

    if (!assignment || assignment.instituteId !== instituteId) {
      throw new NotFoundException('Atribuição não encontrada');
    }

    // Calcular métricas
    const now = new Date();
    const isOverdue = now > assignment.dueAt;

    const totalStatuses = assignment.statuses.length;
    const completedOnTime = assignment.statuses.filter(
      (s) => s.status === 'COMPLETED_ON_TIME'
    ).length;
    const completedLate = assignment.statuses.filter(
      (s) => s.status === 'COMPLETED_LATE'
    ).length;
    const inProgress = assignment.statuses.filter(
      (s) => s.status === 'IN_PROGRESS'
    ).length;
    const pending = assignment.statuses.filter(
      (s) => s.status === 'PENDING'
    ).length;

    return {
      ...assignment,
      metrics: {
        totalStatuses,
        completedOnTime,
        completedLate,
        inProgress,
        pending,
        isOverdue,
        completionRate:
          totalStatuses > 0
            ? Math.round(((completedOnTime + completedLate) / totalStatuses) * 100)
            : 0,
        onTimeRate:
          totalStatuses > 0
            ? Math.round((completedOnTime / totalStatuses) * 100)
            : 0,
      },
    };
  }

  // ============================================
  // ALUNO: Verificar se usuário está no escopo
  // ============================================

  async isUserInScope(
    userId: string,
    assignment: any,
    periodStart: Date,
    periodEnd: Date
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        profession: true,
        instituteId: true,
        unitAssignments: {
          where: {
            startAt: { lte: periodEnd },
            OR: [{ endAt: null }, { endAt: { gte: periodStart } }],
          },
          select: { unitId: true, isPrimary: true, startAt: true, unit: { select: { hospitalId: true } } },
        },
      },
    });

    if (!user || user.instituteId !== assignment.instituteId) {
      return false;
    }

    for (const scope of assignment.scopes) {
      switch (scope.scopeType) {
        case 'INSTITUTE_ALL':
          // Todos os usuários do instituto
          return true;

        case 'INSTITUTE_PROFESSION':
          if (user.profession === scope.profession) {
            return true;
          }
          break;

        case 'HOSPITAL_ALL':
          // Todos os usuários de um hospital específico
          if (user.unitAssignments.some((ua) => ua.unit?.hospitalId === scope.hospitalId)) {
            return true;
          }
          break;

        case 'UNIT_ALL':
          if (user.unitAssignments.some((ua) => ua.unitId === scope.unitId)) {
            return true;
          }
          break;

        case 'UNIT_PROFESSION':
          if (
            user.profession === scope.profession &&
            user.unitAssignments.some((ua) => ua.unitId === scope.unitId)
          ) {
            return true;
          }
          break;

        case 'INDIVIDUAL':
          // Usuários específicos selecionados
          if (scope.userIds?.includes(userId)) {
            return true;
          }
          break;
      }
    }

    return false;
  }

  // ============================================
  // ALUNO: Listar minhas atribuições
  // ============================================

  async getMyAssignments(userId: string, from?: string, to?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { instituteId: true, profession: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Buscar todas atribuições do instituto no período
    const where: any = { instituteId: user.instituteId };
    if (from || to) {
      where.dueAt = {};
      if (from) where.dueAt.gte = new Date(from);
      if (to) where.dueAt.lte = new Date(to);
    }

    const assignments = await this.prisma.assignment.findMany({
      where,
      include: {
        scopes: true,
        course: { select: { id: true, title: true } },
        statuses: {
          where: { userId },
        },
      },
      orderBy: { dueAt: 'asc' },
    });

    // Filtrar apenas as que se aplicam ao usuário e criar status on-demand
    const results = [];

    for (const assignment of assignments) {
      const isInScope = await this.isUserInScope(
        userId,
        assignment,
        assignment.startAt,
        assignment.dueAt
      );

      if (isInScope) {
        let status = assignment.statuses[0];

        // Criar status on-demand se não existir
        if (!status) {
          status = await this.createOrUpdateUserStatus(userId, assignment.id);
        }

        const now = new Date();
        const isOverdue = now > assignment.dueAt &&
          !['COMPLETED_ON_TIME', 'COMPLETED_LATE'].includes(status.status);

        results.push({
          id: assignment.id,
          title: assignment.title,
          course: assignment.course,
          startAt: assignment.startAt,
          dueAt: assignment.dueAt,
          status: status.status,
          completedAt: status.completedAt,
          isOverdue,
        });
      }
    }

    return results;
  }

  // ============================================
  // ALUNO: Detalhes de uma atribuição
  // ============================================

  async getMyAssignmentDetails(userId: string, assignmentId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { instituteId: true },
    });

    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        scopes: true,
        course: {
          include: {
            modules: {
              include: {
                lessons: {
                  select: { id: true, title: true },
                },
              },
            },
          },
        },
      },
    });

    if (!assignment || assignment.instituteId !== user?.instituteId) {
      throw new NotFoundException('Atribuição não encontrada');
    }

    // Verificar se usuário está no escopo
    const isInScope = await this.isUserInScope(
      userId,
      assignment,
      assignment.startAt,
      assignment.dueAt
    );

    if (!isInScope) {
      throw new ForbiddenException('Você não está no escopo desta atribuição');
    }

    // Criar/atualizar status
    const status = await this.createOrUpdateUserStatus(userId, assignmentId);

    // Buscar aprovações do usuário para as aulas do curso
    const lessonIds = assignment.course.modules.flatMap((m) =>
      m.lessons.map((l) => l.id)
    );

    const approvals = await this.prisma.lessonApproval.findMany({
      where: {
        userId,
        lessonId: { in: lessonIds },
      },
    });

    const approvedLessonIds = new Set(approvals.map((a) => a.lessonId));

    // Montar progresso por módulo
    const progress = assignment.course.modules.map((module) => ({
      moduleId: module.id,
      moduleTitle: module.title,
      lessons: module.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        approved: approvedLessonIds.has(lesson.id),
      })),
      completed: module.lessons.every((l) => approvedLessonIds.has(l.id)),
    }));

    const now = new Date();
    const isOverdue = now > assignment.dueAt &&
      !['COMPLETED_ON_TIME', 'COMPLETED_LATE'].includes(status.status);

    return {
      id: assignment.id,
      title: assignment.title,
      course: {
        id: assignment.course.id,
        title: assignment.course.title,
      },
      startAt: assignment.startAt,
      dueAt: assignment.dueAt,
      status: status.status,
      completedAt: status.completedAt,
      isOverdue,
      progress,
      totalLessons: lessonIds.length,
      completedLessons: approvedLessonIds.size,
    };
  }

  // ============================================
  // Criar ou atualizar status do usuário
  // ============================================

  async createOrUpdateUserStatus(userId: string, assignmentId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        course: {
          include: {
            modules: {
              include: {
                lessons: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Atribuição não encontrada');
    }

    // Pegar todas as aulas do curso
    const lessonIds = assignment.course.modules.flatMap((m) =>
      m.lessons.map((l) => l.id)
    );

    if (lessonIds.length === 0) {
      throw new BadRequestException('Curso não possui aulas');
    }

    // Verificar aprovações do usuário
    const approvals = await this.prisma.lessonApproval.findMany({
      where: {
        userId,
        lessonId: { in: lessonIds },
      },
      orderBy: { passedAt: 'desc' },
    });

    const allLessonsApproved = approvals.length === lessonIds.length;

    const now = new Date();
    let newStatus: string;
    let completedAt: Date | null = null;

    if (allLessonsApproved) {
      // Pegar a data da última aprovação
      completedAt = approvals[0]?.passedAt ?? now;

      if (completedAt <= assignment.dueAt) {
        newStatus = 'COMPLETED_ON_TIME';
      } else {
        newStatus = 'COMPLETED_LATE';
      }
    } else if (approvals.length > 0) {
      newStatus = 'IN_PROGRESS';
    } else {
      newStatus = 'PENDING';
    }

    // Upsert status
    return this.prisma.userAssignmentStatus.upsert({
      where: {
        assignmentId_userId: { assignmentId, userId },
      },
      create: {
        assignmentId,
        userId,
        status: newStatus as any,
        completedAt,
      },
      update: {
        status: newStatus as any,
        completedAt,
      },
    });
  }

  // ============================================
  // ALUNO: Forçar recálculo de status
  // ============================================

  async recomputeMyStatus(userId: string, assignmentId: string) {
    // Verificar se usuário está no escopo
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { scopes: true },
    });

    if (!assignment) {
      throw new NotFoundException('Atribuição não encontrada');
    }

    const isInScope = await this.isUserInScope(
      userId,
      assignment,
      assignment.startAt,
      assignment.dueAt
    );

    if (!isInScope) {
      throw new ForbiddenException('Você não está no escopo desta atribuição');
    }

    return this.createOrUpdateUserStatus(userId, assignmentId);
  }

  // ============================================
  // RANKINGS
  // ============================================

  async getRankings(
    instituteId: string,
    type: 'UNIT_ALL' | 'INSTITUTE_PROFESSION' | 'UNIT_PROFESSION',
    from: string,
    to: string,
    unitId?: string
  ) {
    const periodStart = new Date(from);
    const periodEnd = new Date(to);

    // Buscar atribuições no período
    const assignments = await this.prisma.assignment.findMany({
      where: {
        instituteId,
        startAt: { lte: periodEnd },
        dueAt: { gte: periodStart },
      },
      include: {
        scopes: true,
        statuses: {
          include: {
            user: {
              select: {
                id: true,
                profession: true,
                unitAssignments: {
                  where: {
                    startAt: { lte: periodEnd },
                    OR: [{ endAt: null }, { endAt: { gte: periodStart } }],
                  },
                  select: { unitId: true, isPrimary: true, startAt: true },
                  orderBy: [{ isPrimary: 'desc' }, { startAt: 'desc' }],
                },
              },
            },
          },
        },
      },
    });

    if (type === 'UNIT_ALL') {
      return this.calculateUnitAllRanking(assignments, instituteId, periodStart, periodEnd);
    } else if (type === 'INSTITUTE_PROFESSION') {
      return this.calculateInstituteProfessionRanking(assignments, instituteId, periodStart, periodEnd);
    } else if (type === 'UNIT_PROFESSION') {
      if (!unitId) {
        throw new BadRequestException('unitId é obrigatório para UNIT_PROFESSION');
      }
      return this.calculateUnitProfessionRanking(assignments, unitId, periodStart, periodEnd);
    }

    return [];
  }

  // Ranking por Unidade (multiprofissional)
  private async calculateUnitAllRanking(
    assignments: any[],
    instituteId: string,
    periodStart: Date,
    periodEnd: Date
  ) {
    // Buscar todas unidades do instituto
    const units = await this.prisma.unit.findMany({
      where: { hospital: { instituteId } },
      select: { id: true, name: true },
    });

    const rankings = [];

    for (const unit of units) {
      // Filtrar atribuições que têm UNIT_ALL para esta unidade
      const relevantAssignments = assignments.filter((a) =>
        a.scopes.some((s: any) => s.scopeType === 'UNIT_ALL' && s.unitId === unit.id)
      );

      if (relevantAssignments.length === 0) continue;

      // Contar usuários e status
      let activeCount = 0;
      let onTimeCount = 0;
      let lateCount = 0;
      let pendingCount = 0;

      for (const assignment of relevantAssignments) {
        for (const status of assignment.statuses) {
          // Verificar se usuário estava na unidade no período
          // Regra: usar lotação principal do mês, senão a mais recente
          const userUnitInPeriod = this.getPrimaryUnitForPeriod(
            status.user.unitAssignments,
            periodStart,
            periodEnd
          );

          if (userUnitInPeriod === unit.id) {
            activeCount++;
            if (status.status === 'COMPLETED_ON_TIME') onTimeCount++;
            else if (status.status === 'COMPLETED_LATE') lateCount++;
            else pendingCount++;
          }
        }
      }

      if (activeCount > 0) {
        const rate = onTimeCount / activeCount;
        // Para UNIT_ALL não aplica k=20
        rankings.push({
          name: unit.name,
          unitId: unit.id,
          activeCount,
          onTimeCount,
          lateCount,
          pendingCount,
          rate: Math.round(rate * 100),
          score: Math.round(rate * 100), // Score = rate para unidade
        });
      }
    }

    return rankings.sort((a, b) => b.score - a.score);
  }

  // Ranking por Profissão no Instituto (aplica k=20)
  private async calculateInstituteProfessionRanking(
    assignments: any[],
    instituteId: string,
    periodStart: Date,
    periodEnd: Date
  ) {
    // Buscar profissões únicas no instituto
    const users = await this.prisma.user.findMany({
      where: { instituteId },
      select: { profession: true },
      distinct: ['profession'],
    });

    const professions = users.map((u) => u.profession);
    const rankings = [];

    for (const profession of professions) {
      // Filtrar atribuições que têm INSTITUTE_PROFESSION para esta profissão
      const relevantAssignments = assignments.filter((a) =>
        a.scopes.some(
          (s: any) =>
            s.scopeType === 'INSTITUTE_PROFESSION' && s.profession === profession
        )
      );

      if (relevantAssignments.length === 0) continue;

      let activeCount = 0;
      let onTimeCount = 0;
      let lateCount = 0;
      let pendingCount = 0;

      for (const assignment of relevantAssignments) {
        for (const status of assignment.statuses) {
          if (status.user.profession === profession) {
            activeCount++;
            if (status.status === 'COMPLETED_ON_TIME') onTimeCount++;
            else if (status.status === 'COMPLETED_LATE') lateCount++;
            else pendingCount++;
          }
        }
      }

      if (activeCount > 0) {
        const rate = onTimeCount / activeCount;
        // Aplicar k=20: fator = min(1, N/20)
        const k = 20;
        const factor = Math.min(1, activeCount / k);
        const score = rate * factor;

        rankings.push({
          name: profession,
          profession,
          activeCount,
          onTimeCount,
          lateCount,
          pendingCount,
          rate: Math.round(rate * 100),
          score: Math.round(score * 100),
        });
      }
    }

    return rankings.sort((a, b) => b.score - a.score);
  }

  // Ranking por Profissão na Unidade
  private async calculateUnitProfessionRanking(
    assignments: any[],
    unitId: string,
    periodStart: Date,
    periodEnd: Date
  ) {
    // Buscar profissões únicas na unidade
    const unitAssignments = await this.prisma.userUnitAssignment.findMany({
      where: {
        unitId,
        startAt: { lte: periodEnd },
        OR: [{ endAt: null }, { endAt: { gte: periodStart } }],
      },
      select: {
        user: { select: { profession: true } },
      },
      distinct: ['userId'],
    });

    const professions = [...new Set(unitAssignments.map((ua) => ua.user.profession))];
    const rankings = [];

    for (const profession of professions) {
      // Filtrar atribuições que têm UNIT_PROFESSION para esta unidade e profissão
      const relevantAssignments = assignments.filter((a) =>
        a.scopes.some(
          (s: any) =>
            s.scopeType === 'UNIT_PROFESSION' &&
            s.unitId === unitId &&
            s.profession === profession
        )
      );

      if (relevantAssignments.length === 0) continue;

      let activeCount = 0;
      let onTimeCount = 0;
      let lateCount = 0;
      let pendingCount = 0;

      for (const assignment of relevantAssignments) {
        for (const status of assignment.statuses) {
          if (
            status.user.profession === profession &&
            status.user.unitAssignments.some((ua: any) => ua.unitId === unitId)
          ) {
            activeCount++;
            if (status.status === 'COMPLETED_ON_TIME') onTimeCount++;
            else if (status.status === 'COMPLETED_LATE') lateCount++;
            else pendingCount++;
          }
        }
      }

      if (activeCount > 0) {
        const rate = onTimeCount / activeCount;
        rankings.push({
          name: profession,
          profession,
          activeCount,
          onTimeCount,
          lateCount,
          pendingCount,
          rate: Math.round(rate * 100),
          score: Math.round(rate * 100), // Sem k para unidade
        });
      }
    }

    return rankings.sort((a, b) => b.score - a.score);
  }

  /**
   * Determina a unidade principal do usuário no período.
   * Regra para MVP:
   * - Se existir isPrimary=true no período, usar ela
   * - Senão, usar a lotação ativa mais recente no período
   */
  private getPrimaryUnitForPeriod(
    unitAssignments: Array<{ unitId: string; isPrimary: boolean; startAt: Date }>,
    periodStart: Date,
    periodEnd: Date
  ): string | null {
    if (unitAssignments.length === 0) return null;

    // Já está ordenado por isPrimary desc, startAt desc
    // Primeiro isPrimary=true, senão o mais recente
    return unitAssignments[0]?.unitId ?? null;
  }
}
