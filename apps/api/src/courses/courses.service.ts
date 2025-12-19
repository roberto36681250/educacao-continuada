import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { ContentStatus } from '@prisma/client';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async findByInstitute(instituteId: string, includeUnpublished = false) {
    const where: {
      instituteId: string;
      status?: ContentStatus;
      currentPublishedVersionId?: { not: null };
    } = { instituteId };

    if (!includeUnpublished) {
      // Aluno so ve cursos com versao publicada
      where.currentPublishedVersionId = { not: null };
    }

    return this.prisma.course.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        sortOrder: true,
        createdAt: true,
        currentPublishedVersionId: true,
        _count: {
          select: { modules: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        institute: { select: { id: true, name: true } },
        modules: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            sortOrder: true,
            _count: { select: { lessons: true } },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Curso não encontrado');
    }

    return course;
  }

  async create(dto: CreateCourseDto) {
    return this.prisma.course.create({
      data: {
        title: dto.title,
        description: dto.description,
        instituteId: dto.instituteId,
        status: dto.status || ContentStatus.DRAFT,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateCourseDto) {
    const existing = await this.prisma.course.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Curso não encontrado');
    }

    return this.prisma.course.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
      },
    });
  }

  /**
   * Publicar curso
   * Regra: deve ter ao menos 1 módulo PUBLISHED
   * E todas as lessons PUBLISHED devem ter quiz válido
   */
  async publishCourse(courseId: string, userId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          include: {
            lessons: {
              where: { status: ContentStatus.PUBLISHED },
              include: {
                quiz: {
                  include: {
                    questions: {
                      include: { options: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Curso não encontrado');
    }

    // Verificar se tem ao menos 1 módulo publicado
    const publishedModules = course.modules.filter(
      (m) => m.status === ContentStatus.PUBLISHED
    );

    if (publishedModules.length === 0) {
      throw new BadRequestException('Curso deve ter ao menos um módulo publicado');
    }

    // Verificar se todas as lessons publicadas têm quiz válido
    for (const module of course.modules) {
      for (const lesson of module.lessons) {
        if (!lesson.quiz) {
          throw new BadRequestException(
            `Aula "${lesson.title}" está publicada mas não tem quiz`
          );
        }

        const questionCount = lesson.quiz.questions.length;
        if (questionCount < 5) {
          throw new BadRequestException(
            `Aula "${lesson.title}" tem quiz com menos de 5 questões (${questionCount})`
          );
        }

        for (const question of lesson.quiz.questions) {
          if (question.options.length < 2) {
            throw new BadRequestException(
              `Aula "${lesson.title}" tem questão com menos de 2 opções`
            );
          }
          if (!question.options.some((o) => o.isCorrect)) {
            throw new BadRequestException(
              `Aula "${lesson.title}" tem questão sem opção correta`
            );
          }
        }
      }
    }

    await this.prisma.course.update({
      where: { id: courseId },
      data: { status: ContentStatus.PUBLISHED },
    });

    // Registrar auditoria
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'COURSE_PUBLISHED',
        entity: 'Course',
        entityId: courseId,
        metadata: {
          title: course.title,
          publishedModulesCount: publishedModules.length,
        },
      },
    });

    return { success: true, message: 'Curso publicado com sucesso' };
  }
}
