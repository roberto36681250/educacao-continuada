import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailEnqueueService } from './email-enqueue.service';
import { UserRole, UserAssignmentStatusEnum } from '@prisma/client';

@Injectable()
export class EmailSchedulerService {
  private readonly logger = new Logger(EmailSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private emailEnqueue: EmailEnqueueService,
  ) {}

  /**
   * Lembrete de assignments com prazo em 3 dias
   * Executar diariamente às 08:00
   */
  async sendAssignmentDueSoonReminders() {
    this.logger.log('Iniciando lembretes de assignments com prazo próximo...');

    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    threeDaysFromNow.setHours(23, 59, 59, 999);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Buscar status de assignments não completados com deadline em até 3 dias
    const userStatuses = await this.prisma.userAssignmentStatus.findMany({
      where: {
        status: { in: [UserAssignmentStatusEnum.PENDING, UserAssignmentStatusEnum.IN_PROGRESS] },
        assignment: {
          dueAt: {
            gte: today,
            lte: threeDaysFromNow,
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            instituteId: true,
          },
        },
        assignment: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(`Encontrados ${userStatuses.length} usuários com prazo próximo`);

    const baseUrl = process.env.WEB_URL || 'http://localhost:3000';
    let enqueued = 0;

    for (const status of userStatuses) {
      // Calcular progresso (simplificado - contar aulas assistidas / total)
      const totalLessons = await this.prisma.lesson.count({
        where: { module: { courseId: status.assignment.courseId } },
      });

      const watchedLessons = await this.prisma.videoProgress.count({
        where: {
          userId: status.userId,
          lesson: { module: { courseId: status.assignment.courseId } },
          watchedPct: { gte: 90 },
        },
      });

      const progress = totalLessons > 0 ? Math.round((watchedLessons / totalLessons) * 100) : 0;

      // Enfileirar email
      await this.emailEnqueue.enqueue({
        instituteId: status.user.instituteId,
        eventKey: 'ASSIGNMENT_DUE_SOON',
        toEmail: status.user.email,
        toName: status.user.name,
        templateKey: 'ASSIGNMENT_DUE_SOON',
        payload: {
          userName: status.user.name,
          courseName: status.assignment.course.title,
          dueDate: status.assignment.dueAt.toLocaleDateString('pt-BR'),
          progress,
          courseUrl: `${baseUrl}/curso/${status.assignment.courseId}`,
        },
        dedupKey: `assignment-due-soon-${status.id}-${status.assignment.dueAt.toISOString().split('T')[0]}`,
      });
      enqueued++;
    }

    this.logger.log(`Enfileirados ${enqueued} lembretes de prazo próximo`);
    return { enqueued };
  }

  /**
   * Lembrete de assignments em atraso
   * Executar diariamente às 08:00
   */
  async sendAssignmentOverdueReminders() {
    this.logger.log('Iniciando lembretes de assignments em atraso...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Buscar status de assignments não completados com deadline passada
    const userStatuses = await this.prisma.userAssignmentStatus.findMany({
      where: {
        status: { in: [UserAssignmentStatusEnum.PENDING, UserAssignmentStatusEnum.IN_PROGRESS] },
        assignment: {
          dueAt: { lt: today },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            instituteId: true,
          },
        },
        assignment: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(`Encontrados ${userStatuses.length} usuários em atraso`);

    const baseUrl = process.env.WEB_URL || 'http://localhost:3000';
    let enqueued = 0;

    for (const status of userStatuses) {
      // Calcular progresso
      const totalLessons = await this.prisma.lesson.count({
        where: { module: { courseId: status.assignment.courseId } },
      });

      const watchedLessons = await this.prisma.videoProgress.count({
        where: {
          userId: status.userId,
          lesson: { module: { courseId: status.assignment.courseId } },
          watchedPct: { gte: 90 },
        },
      });

      const progress = totalLessons > 0 ? Math.round((watchedLessons / totalLessons) * 100) : 0;

      // Enfileirar email (uma vez por dia para cada assignment em atraso)
      const todayKey = new Date().toISOString().split('T')[0];
      await this.emailEnqueue.enqueue({
        instituteId: status.user.instituteId,
        eventKey: 'ASSIGNMENT_OVERDUE',
        toEmail: status.user.email,
        toName: status.user.name,
        templateKey: 'ASSIGNMENT_OVERDUE',
        payload: {
          userName: status.user.name,
          courseName: status.assignment.course.title,
          dueDate: status.assignment.dueAt.toLocaleDateString('pt-BR'),
          progress,
          courseUrl: `${baseUrl}/curso/${status.assignment.courseId}`,
        },
        dedupKey: `assignment-overdue-${status.id}-${todayKey}`,
      });
      enqueued++;
    }

    this.logger.log(`Enfileirados ${enqueued} lembretes de atraso`);
    return { enqueued };
  }

  /**
   * Lembrete de revisões pendentes para MANAGERs
   * Executar diariamente às 08:10
   */
  async sendReviewDueReminders() {
    this.logger.log('Iniciando lembretes de revisões pendentes...');

    // Buscar estados de competência com estado RED ou ORANGE (precisam de atenção)
    const pendingReviews = await this.prisma.userCompetencyState.findMany({
      where: {
        state: { in: ['RED', 'ORANGE'] },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            instituteId: true,
          },
        },
        competency: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: 100, // Limitar para não sobrecarregar
    });

    this.logger.log(`Encontradas ${pendingReviews.length} competências pendentes de atenção`);

    // Agrupar por instituto e buscar gestores
    const reviewsByInstitute = new Map<string, typeof pendingReviews>();
    for (const review of pendingReviews) {
      const instituteId = review.user.instituteId;
      if (!reviewsByInstitute.has(instituteId)) {
        reviewsByInstitute.set(instituteId, []);
      }
      reviewsByInstitute.get(instituteId)!.push(review);
    }

    const baseUrl = process.env.WEB_URL || 'http://localhost:3000';
    let enqueued = 0;

    for (const [instituteId, reviews] of reviewsByInstitute) {
      // Buscar gestores do instituto (MANAGER e ADMIN_MASTER)
      const managers = await this.prisma.user.findMany({
        where: {
          instituteId,
          role: { in: [UserRole.MANAGER, UserRole.ADMIN_MASTER] },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      // Para cada gestor, enviar email resumo (não um por revisão)
      const todayKey = new Date().toISOString().split('T')[0];
      for (const manager of managers) {
        // Enviar apenas um email resumo por dia
        await this.emailEnqueue.enqueue({
          instituteId,
          eventKey: 'REVIEW_DUE',
          toEmail: manager.email,
          toName: manager.name,
          templateKey: 'REVIEW_DUE',
          payload: {
            reviewerName: manager.name,
            studentName: `${reviews.length} alunos`,
            competencyName: 'Múltiplas competências',
            submittedDate: new Date().toLocaleDateString('pt-BR'),
            reviewUrl: `${baseUrl}/gestor/revisoes`,
          },
          dedupKey: `review-due-${instituteId}-${manager.id}-${todayKey}`,
        });
        enqueued++;
      }
    }

    this.logger.log(`Enfileirados ${enqueued} lembretes de revisão`);
    return { enqueued };
  }

  /**
   * Digest semanal para MANAGERs e ADMIN_MASTERs
   * Executar segundas-feiras às 08:30
   */
  async sendWeeklyDigest() {
    this.logger.log('Iniciando digest semanal...');

    // Buscar todos os institutos
    const institutes = await this.prisma.institute.findMany();

    const baseUrl = process.env.WEB_URL || 'http://localhost:3000';
    let enqueued = 0;

    // Calcular período da semana anterior
    const weekEnd = new Date();
    weekEnd.setHours(0, 0, 0, 0);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);

    for (const institute of institutes) {
      // Métricas da semana
      const [activeUsers, completedLessons, quizzesCompleted, certificatesIssued, overdueCount, pendingReviews] =
        await Promise.all([
          // Usuários que fizeram alguma atividade
          this.prisma.videoProgress.groupBy({
            by: ['userId'],
            where: {
              lesson: { module: { course: { instituteId: institute.id } } },
              updatedAt: { gte: weekStart, lt: weekEnd },
            },
          }),
          // Aulas completadas
          this.prisma.videoProgress.count({
            where: {
              lesson: { module: { course: { instituteId: institute.id } } },
              watchedPct: { gte: 90 },
              updatedAt: { gte: weekStart, lt: weekEnd },
            },
          }),
          // Quizzes realizados
          this.prisma.quizAttempt.count({
            where: {
              quiz: { lesson: { module: { course: { instituteId: institute.id } } } },
              finishedAt: { gte: weekStart, lt: weekEnd },
            },
          }),
          // Certificados emitidos
          this.prisma.certificate.count({
            where: {
              course: { instituteId: institute.id },
              issuedAt: { gte: weekStart, lt: weekEnd },
            },
          }),
          // Treinamentos em atraso (UserAssignmentStatus)
          this.prisma.userAssignmentStatus.count({
            where: {
              assignment: {
                instituteId: institute.id,
                dueAt: { lt: new Date() },
              },
              status: { in: [UserAssignmentStatusEnum.PENDING, UserAssignmentStatusEnum.IN_PROGRESS] },
            },
          }),
          // Revisões pendentes
          this.prisma.userCompetencyState.count({
            where: {
              user: { instituteId: institute.id },
              state: { in: ['RED', 'ORANGE'] },
            },
          }),
        ]);

      // Buscar gestores e admins
      const recipients = await this.prisma.user.findMany({
        where: {
          instituteId: institute.id,
          role: { in: [UserRole.MANAGER, UserRole.ADMIN_MASTER] },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      const weekKey = `${weekStart.toISOString().split('T')[0]}-${weekEnd.toISOString().split('T')[0]}`;

      for (const recipient of recipients) {
        await this.emailEnqueue.enqueue({
          instituteId: institute.id,
          eventKey: 'WEEKLY_DIGEST',
          toEmail: recipient.email,
          toName: recipient.name,
          templateKey: 'WEEKLY_DIGEST',
          payload: {
            userName: recipient.name,
            activeUsers: activeUsers.length,
            completedLessons,
            quizzesCompleted,
            certificatesIssued,
            overdueCount,
            pendingReviews,
            dashboardUrl: `${baseUrl}/gestor`,
          },
          dedupKey: `weekly-digest-${recipient.id}-${weekKey}`,
        });
        enqueued++;
      }
    }

    this.logger.log(`Enfileirados ${enqueued} digests semanais`);
    return { enqueued };
  }

  /**
   * Executar todos os schedulers de reminder
   * Para ser chamado manualmente ou via cron externo
   */
  async runDailyReminders() {
    const results = {
      dueSoon: await this.sendAssignmentDueSoonReminders(),
      overdue: await this.sendAssignmentOverdueReminders(),
      reviews: await this.sendReviewDueReminders(),
    };
    return results;
  }
}
