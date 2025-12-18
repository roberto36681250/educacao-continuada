import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContentStatus, FAQStatus } from '@prisma/client';

interface SearchResult {
  courses: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
  }>;
  lessons: Array<{
    id: string;
    title: string;
    courseId: string;
    courseTitle: string;
    moduleTitle: string;
    status: string;
  }>;
  faqs: Array<{
    id: string;
    question: string;
    courseId: string;
    courseTitle: string;
  }>;
  competencies: Array<{
    id: string;
    name: string;
    description: string | null;
  }>;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca global com regras de permissão:
   * - ALUNO (USER): apenas cursos e aulas PUBLISHED, FAQs PUBLISHED
   * - GESTOR (MANAGER/ADMIN/ADMIN_MASTER): pode ver DRAFT, REVIEWED, APPROVED também
   */
  async search(
    query: string,
    instituteId: string,
    userRole: string,
  ): Promise<SearchResult> {
    if (!query || query.trim().length < 2) {
      return { courses: [], lessons: [], faqs: [], competencies: [] };
    }

    const searchTerm = `%${query.trim().toLowerCase()}%`;
    const isGestor = ['ADMIN_MASTER', 'ADMIN', 'MANAGER'].includes(userRole);

    // Definir status permitidos baseado no role
    const allowedContentStatuses: ContentStatus[] = isGestor
      ? [
          ContentStatus.DRAFT,
          ContentStatus.REVIEWED,
          ContentStatus.APPROVED,
          ContentStatus.PUBLISHED,
        ]
      : [ContentStatus.PUBLISHED];

    const allowedFaqStatuses: FAQStatus[] = isGestor
      ? [FAQStatus.DRAFT, FAQStatus.PUBLISHED]
      : [FAQStatus.PUBLISHED];

    // Buscar em paralelo
    const [courses, lessons, faqs, competencies] = await Promise.all([
      // Cursos
      this.prisma.course.findMany({
        where: {
          instituteId,
          status: { in: allowedContentStatuses },
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
        },
        take: 10,
        orderBy: { title: 'asc' },
      }),

      // Aulas
      this.prisma.lesson.findMany({
        where: {
          status: { in: allowedContentStatuses },
          module: {
            status: { in: allowedContentStatuses },
            course: {
              instituteId,
              status: { in: allowedContentStatuses },
            },
          },
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          module: {
            select: {
              title: true,
              course: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
        take: 10,
        orderBy: { title: 'asc' },
      }),

      // FAQs
      this.prisma.fAQ.findMany({
        where: {
          instituteId,
          status: { in: allowedFaqStatuses },
          OR: [
            { question: { contains: query, mode: 'insensitive' } },
            { answer: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          question: true,
          course: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        take: 10,
        orderBy: { question: 'asc' },
      }),

      // Competências
      this.prisma.competency.findMany({
        where: {
          instituteId,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          description: true,
        },
        take: 10,
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      courses: courses.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        status: c.status,
      })),
      lessons: lessons.map((l) => ({
        id: l.id,
        title: l.title,
        courseId: l.module.course.id,
        courseTitle: l.module.course.title,
        moduleTitle: l.module.title,
        status: l.status,
      })),
      faqs: faqs.map((f) => ({
        id: f.id,
        question: f.question,
        courseId: f.course.id,
        courseTitle: f.course.title,
      })),
      competencies: competencies.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
      })),
    };
  }
}
