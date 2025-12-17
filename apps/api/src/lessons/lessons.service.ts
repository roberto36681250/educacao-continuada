import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { ContentStatus } from '@prisma/client';

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
}
