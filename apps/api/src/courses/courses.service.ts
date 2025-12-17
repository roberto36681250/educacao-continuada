import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { ContentStatus } from '@prisma/client';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async findByInstitute(instituteId: string, includeUnpublished = false) {
    const where: { instituteId: string; status?: ContentStatus } = { instituteId };
    if (!includeUnpublished) {
      where.status = ContentStatus.PUBLISHED;
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
}
