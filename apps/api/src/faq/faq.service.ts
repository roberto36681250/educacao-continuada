import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FAQStatus } from '@prisma/client';

@Injectable()
export class FAQService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // PUBLIC ENDPOINTS (for logged users)
  // ============================================

  async getFAQsByCourse(courseId: string) {
    return this.prisma.fAQ.findMany({
      where: {
        courseId,
        status: FAQStatus.PUBLISHED,
      },
      select: {
        id: true,
        question: true,
        answer: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ============================================
  // GESTOR/PROFESSOR ENDPOINTS
  // ============================================

  async createFAQ(
    userId: string,
    instituteId: string,
    data: {
      courseId: string;
      question: string;
      answer: string;
      status?: FAQStatus;
    },
  ) {
    // Verify course belongs to institute
    const course = await this.prisma.course.findUnique({
      where: { id: data.courseId },
    });

    if (!course || course.instituteId !== instituteId) {
      throw new ForbiddenException('Curso não encontrado ou sem permissão');
    }

    return this.prisma.fAQ.create({
      data: {
        instituteId,
        courseId: data.courseId,
        question: data.question,
        answer: data.answer,
        status: data.status || FAQStatus.DRAFT,
        createdByUserId: userId,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  async updateFAQ(
    faqId: string,
    instituteId: string,
    data: {
      question?: string;
      answer?: string;
    },
  ) {
    const faq = await this.prisma.fAQ.findUnique({
      where: { id: faqId },
    });

    if (!faq || faq.instituteId !== instituteId) {
      throw new NotFoundException('FAQ não encontrada');
    }

    return this.prisma.fAQ.update({
      where: { id: faqId },
      data: {
        question: data.question,
        answer: data.answer,
      },
    });
  }

  async updateFAQStatus(
    faqId: string,
    status: FAQStatus,
    instituteId: string,
  ) {
    const faq = await this.prisma.fAQ.findUnique({
      where: { id: faqId },
    });

    if (!faq || faq.instituteId !== instituteId) {
      throw new NotFoundException('FAQ não encontrada');
    }

    return this.prisma.fAQ.update({
      where: { id: faqId },
      data: { status },
    });
  }

  async getAllFAQsByCourse(courseId: string, instituteId: string) {
    // Verify course belongs to institute
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course || course.instituteId !== instituteId) {
      throw new ForbiddenException('Curso não encontrado ou sem permissão');
    }

    return this.prisma.fAQ.findMany({
      where: { courseId },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteFAQ(faqId: string, instituteId: string) {
    const faq = await this.prisma.fAQ.findUnique({
      where: { id: faqId },
    });

    if (!faq || faq.instituteId !== instituteId) {
      throw new NotFoundException('FAQ não encontrada');
    }

    await this.prisma.fAQ.delete({
      where: { id: faqId },
    });

    return { message: 'FAQ excluída com sucesso' };
  }
}
