import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ContentStatus } from '@prisma/client';

@Injectable()
export class ModulesService {
  constructor(private prisma: PrismaService) {}

  async findByCourse(courseId: string, includeUnpublished = false) {
    const where: { courseId: string; status?: ContentStatus } = { courseId };
    if (!includeUnpublished) {
      where.status = ContentStatus.PUBLISHED;
    }

    return this.prisma.module.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        sortOrder: true,
        createdAt: true,
        _count: {
          select: { lessons: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const module = await this.prisma.module.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, title: true, instituteId: true } },
        lessons: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            youtubeVideoId: true,
            durationSeconds: true,
            status: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!module) {
      throw new NotFoundException('Módulo não encontrado');
    }

    return module;
  }

  async create(dto: CreateModuleDto) {
    const maxOrder = await this.prisma.module.aggregate({
      where: { courseId: dto.courseId },
      _max: { sortOrder: true },
    });

    return this.prisma.module.create({
      data: {
        title: dto.title,
        description: dto.description,
        courseId: dto.courseId,
        status: dto.status || ContentStatus.DRAFT,
        sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        sortOrder: true,
        createdAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateModuleDto) {
    const existing = await this.prisma.module.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Módulo não encontrado');
    }

    return this.prisma.module.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        sortOrder: dto.sortOrder,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        sortOrder: true,
        createdAt: true,
      },
    });
  }
}
