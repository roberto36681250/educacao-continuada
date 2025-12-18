import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface HomeDataAluno {
  role: 'USER';
  pendingAssignments: Array<{
    id: string;
    title: string;
    dueAt: string;
    isOverdue: boolean;
    course: { id: string; title: string };
  }>;
  dueReviews: Array<{
    id: string;
    dueAt: string;
    status: string;
    competency: { id: string; name: string };
  }>;
  continueLesson: {
    lessonId: string;
    title: string;
    courseId: string;
    courseTitle: string;
    watchedPct: number;
  } | null;
  recentCertificates: Array<{
    id: string;
    code: string;
    courseTitle: string;
    issuedAt: string;
  }>;
}

interface HomeDataGestor {
  role: 'MANAGER' | 'ADMIN' | 'ADMIN_MASTER';
  summary: {
    activeAssignments: number;
    openTickets: number;
    onTimePercentage: number;
    redCompetencies: number;
  };
  recentTickets: Array<{
    id: string;
    subject: string;
    status: string;
    createdAt: string;
  }>;
}

type HomeData = HomeDataAluno | HomeDataGestor;

@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}

  async getHomeData(userId: string, instituteId: string, role: string): Promise<HomeData> {
    const isGestor = ['ADMIN_MASTER', 'ADMIN', 'MANAGER'].includes(role);

    if (isGestor) {
      return this.getGestorHomeData(instituteId, role as 'MANAGER' | 'ADMIN' | 'ADMIN_MASTER');
    }

    return this.getAlunoHomeData(userId, instituteId);
  }

  private async getAlunoHomeData(userId: string, instituteId: string): Promise<HomeDataAluno> {
    const now = new Date();

    const [assignments, reviews, lastSeen, certificates] = await Promise.all([
      // Pending assignments
      this.prisma.userAssignmentStatus.findMany({
        where: {
          userId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
        include: {
          assignment: {
            include: {
              course: { select: { id: true, title: true } },
            },
          },
        },
        orderBy: { assignment: { dueAt: 'asc' } },
        take: 5,
      }),

      // Due reviews (today or overdue)
      this.prisma.competencyReviewSchedule.findMany({
        where: {
          userId,
          status: { in: ['DUE', 'OVERDUE'] },
        },
        include: {
          competency: { select: { id: true, name: true } },
        },
        orderBy: { dueAt: 'asc' },
        take: 5,
      }),

      // Last seen lesson with incomplete progress
      this.prisma.lessonLastSeen.findFirst({
        where: {
          userId,
          lesson: {
            videoProgress: {
              some: {
                userId,
                completed: false,
              },
            },
          },
        },
        include: {
          lesson: {
            include: {
              videoProgress: {
                where: { userId },
                take: 1,
              },
              module: {
                include: {
                  course: { select: { id: true, title: true } },
                },
              },
            },
          },
        },
        orderBy: { seenAt: 'desc' },
      }),

      // Recent certificates
      this.prisma.certificate.findMany({
        where: { userId },
        include: {
          course: { select: { title: true } },
        },
        orderBy: { issuedAt: 'desc' },
        take: 3,
      }),
    ]);

    return {
      role: 'USER',
      pendingAssignments: assignments.map((a) => ({
        id: a.assignmentId,
        title: a.assignment.title,
        dueAt: a.assignment.dueAt.toISOString(),
        isOverdue: a.assignment.dueAt < now,
        course: {
          id: a.assignment.course.id,
          title: a.assignment.course.title,
        },
      })),
      dueReviews: reviews.map((r) => ({
        id: r.id,
        dueAt: r.dueAt.toISOString(),
        status: r.status,
        competency: {
          id: r.competencyId,
          name: r.competency.name,
        },
      })),
      continueLesson: lastSeen
        ? {
            lessonId: lastSeen.lessonId,
            title: lastSeen.lesson.title,
            courseId: lastSeen.lesson.module.course.id,
            courseTitle: lastSeen.lesson.module.course.title,
            watchedPct: lastSeen.lesson.videoProgress[0]?.watchedPct ?? 0,
          }
        : null,
      recentCertificates: certificates.map((c) => ({
        id: c.id,
        code: c.code,
        courseTitle: c.course.title,
        issuedAt: c.issuedAt.toISOString(),
      })),
    };
  }

  private async getGestorHomeData(
    instituteId: string,
    role: 'MANAGER' | 'ADMIN' | 'ADMIN_MASTER',
  ): Promise<HomeDataGestor> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [activeAssignments, openTickets, completionStats, redCompetencies, recentTickets] =
      await Promise.all([
        // Active assignments count
        this.prisma.assignment.count({
          where: {
            instituteId,
            startAt: { lte: now },
            dueAt: { gte: now },
          },
        }),

        // Open tickets count
        this.prisma.ticket.count({
          where: {
            instituteId,
            status: { in: ['OPEN', 'IN_PROGRESS'] },
          },
        }),

        // Completion stats this month
        this.prisma.userAssignmentStatus.groupBy({
          by: ['status'],
          where: {
            assignment: { instituteId },
            updatedAt: { gte: startOfMonth },
            status: { in: ['COMPLETED_ON_TIME', 'COMPLETED_LATE'] },
          },
          _count: true,
        }),

        // Red competencies count
        this.prisma.userCompetencyState.count({
          where: {
            user: { instituteId },
            state: 'RED',
          },
        }),

        // Recent tickets
        this.prisma.ticket.findMany({
          where: {
            instituteId,
            status: { in: ['OPEN', 'IN_PROGRESS'] },
          },
          select: {
            id: true,
            subject: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

    const onTimeCount =
      completionStats.find((s) => s.status === 'COMPLETED_ON_TIME')?._count ?? 0;
    const lateCount =
      completionStats.find((s) => s.status === 'COMPLETED_LATE')?._count ?? 0;
    const totalCompleted = onTimeCount + lateCount;
    const onTimePercentage = totalCompleted > 0 ? Math.round((onTimeCount / totalCompleted) * 100) : 100;

    return {
      role,
      summary: {
        activeAssignments,
        openTickets,
        onTimePercentage,
        redCompetencies,
      },
      recentTickets: recentTickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  // Registrar última aula acessada
  async recordLessonSeen(userId: string, lessonId: string): Promise<void> {
    await this.prisma.lessonLastSeen.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { seenAt: new Date() },
      create: { userId, lessonId },
    });
  }
}
