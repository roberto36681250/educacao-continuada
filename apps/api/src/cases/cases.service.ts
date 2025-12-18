import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AnonymizationRulesService,
  AnonymizationResult,
} from '../anonymization-rules/anonymization-rules.service';
import { ClinicalCaseStatus } from '@prisma/client';

@Injectable()
export class CasesService {
  constructor(
    private prisma: PrismaService,
    private anonymizationService: AnonymizationRulesService,
  ) {}

  async findAll(
    instituteId: string,
    userRole: string,
  ) {
    // Aluno vê só PUBLISHED, gestor vê todos
    const statusFilter =
      userRole === 'USER'
        ? { status: ClinicalCaseStatus.PUBLISHED }
        : {};

    return this.prisma.clinicalCase.findMany({
      where: {
        instituteId,
        ...statusFilter,
      },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, instituteId: string, userRole: string) {
    const caseData = await this.prisma.clinicalCase.findFirst({
      where: { id, instituteId },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!caseData) {
      throw new NotFoundException('Caso clínico não encontrado');
    }

    // Aluno só pode ver PUBLISHED
    if (
      userRole === 'USER' &&
      caseData.status !== ClinicalCaseStatus.PUBLISHED
    ) {
      throw new NotFoundException('Caso clínico não encontrado');
    }

    return caseData;
  }

  async create(
    instituteId: string,
    userId: string,
    data: { title: string; textAnonymized?: string },
  ) {
    return this.prisma.clinicalCase.create({
      data: {
        instituteId,
        createdByUserId: userId,
        title: data.title,
        textAnonymized: data.textAnonymized || '',
        status: ClinicalCaseStatus.DRAFT,
      },
    });
  }

  async update(
    id: string,
    instituteId: string,
    data: { title?: string; textAnonymized?: string },
  ) {
    const existing = await this.prisma.clinicalCase.findFirst({
      where: { id, instituteId },
    });

    if (!existing) {
      throw new NotFoundException('Caso clínico não encontrado');
    }

    return this.prisma.clinicalCase.update({
      where: { id },
      data,
    });
  }

  async anonymize(
    caseId: string,
    instituteId: string,
    userId: string,
    rawText: string,
  ): Promise<AnonymizationResult & { caseId: string }> {
    const existing = await this.prisma.clinicalCase.findFirst({
      where: { id: caseId, instituteId },
    });

    if (!existing) {
      throw new NotFoundException('Caso clínico não encontrado');
    }

    const result = await this.anonymizationService.anonymizeText(
      instituteId,
      rawText,
    );

    // Registrar log de anonimização
    await this.prisma.anonymizationLog.create({
      data: {
        instituteId,
        clinicalCaseId: caseId,
        actorUserId: userId,
        appliedRulesCount: result.findings.length,
        findings: result.findings as any,
      },
    });

    // Registrar no AuditLog também
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'ANONYMIZE_CASE',
        entity: 'ClinicalCase',
        entityId: caseId,
        metadata: {
          findingsCount: result.findings.reduce((acc, f) => acc + f.count, 0),
          rulesApplied: result.findings.map((f) => f.type),
        },
      },
    });

    return {
      caseId,
      ...result,
    };
  }

  async publish(id: string, instituteId: string, userId: string) {
    const existing = await this.prisma.clinicalCase.findFirst({
      where: { id, instituteId },
    });

    if (!existing) {
      throw new NotFoundException('Caso clínico não encontrado');
    }

    // Verificar se ainda há dados sensíveis críticos
    const detection = await this.anonymizationService.detectSensitiveData(
      instituteId,
      existing.textAnonymized,
    );

    if (detection.hasCriticalData) {
      throw new BadRequestException({
        message: 'Não é possível publicar: dados sensíveis detectados',
        findings: detection.findings,
      });
    }

    const updated = await this.prisma.clinicalCase.update({
      where: { id },
      data: { status: ClinicalCaseStatus.PUBLISHED },
    });

    // Auditoria
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'PUBLISH_CASE',
        entity: 'ClinicalCase',
        entityId: id,
      },
    });

    return updated;
  }

  async archive(id: string, instituteId: string, userId: string) {
    const existing = await this.prisma.clinicalCase.findFirst({
      where: { id, instituteId },
    });

    if (!existing) {
      throw new NotFoundException('Caso clínico não encontrado');
    }

    const updated = await this.prisma.clinicalCase.update({
      where: { id },
      data: { status: ClinicalCaseStatus.ARCHIVED },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'ARCHIVE_CASE',
        entity: 'ClinicalCase',
        entityId: id,
      },
    });

    return updated;
  }

  async delete(id: string, instituteId: string) {
    const existing = await this.prisma.clinicalCase.findFirst({
      where: { id, instituteId },
    });

    if (!existing) {
      throw new NotFoundException('Caso clínico não encontrado');
    }

    return this.prisma.clinicalCase.delete({
      where: { id },
    });
  }
}
