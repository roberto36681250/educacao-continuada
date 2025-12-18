import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AnonymizationFinding {
  type: string;
  count: number;
  matches: string[];
}

export interface AnonymizationResult {
  anonymizedText: string;
  findings: AnonymizationFinding[];
  diffPreview: { original: string; replacement: string }[];
  hasCriticalData: boolean;
}

@Injectable()
export class AnonymizationRulesService {
  constructor(private prisma: PrismaService) {}

  async findAll(instituteId: string) {
    return this.prisma.anonymizationRule.findMany({
      where: { instituteId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string, instituteId: string) {
    const rule = await this.prisma.anonymizationRule.findFirst({
      where: { id, instituteId },
    });
    if (!rule) {
      throw new NotFoundException('Regra não encontrada');
    }
    return rule;
  }

  async create(
    instituteId: string,
    data: {
      name: string;
      pattern: string;
      replacement: string;
      isEnabled?: boolean;
      isCritical?: boolean;
    },
  ) {
    const maxOrder = await this.prisma.anonymizationRule.aggregate({
      where: { instituteId },
      _max: { sortOrder: true },
    });

    return this.prisma.anonymizationRule.create({
      data: {
        instituteId,
        name: data.name,
        pattern: data.pattern,
        replacement: data.replacement,
        isEnabled: data.isEnabled ?? true,
        isCritical: data.isCritical ?? false,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });
  }

  async update(
    id: string,
    instituteId: string,
    data: {
      name?: string;
      pattern?: string;
      replacement?: string;
      isEnabled?: boolean;
      isCritical?: boolean;
      sortOrder?: number;
    },
  ) {
    await this.findOne(id, instituteId);
    return this.prisma.anonymizationRule.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, instituteId: string) {
    await this.findOne(id, instituteId);
    return this.prisma.anonymizationRule.delete({
      where: { id },
    });
  }

  async anonymizeText(
    instituteId: string,
    rawText: string,
  ): Promise<AnonymizationResult> {
    const rules = await this.prisma.anonymizationRule.findMany({
      where: { instituteId, isEnabled: true },
      orderBy: { sortOrder: 'asc' },
    });

    let anonymizedText = rawText;
    const findings: AnonymizationFinding[] = [];
    const diffPreview: { original: string; replacement: string }[] = [];
    let hasCriticalData = false;

    for (const rule of rules) {
      try {
        const regex = new RegExp(rule.pattern, 'gi');
        const matches = rawText.match(regex) || [];

        if (matches.length > 0) {
          findings.push({
            type: rule.name,
            count: matches.length,
            matches: [...new Set(matches)].slice(0, 5),
          });

          if (rule.isCritical) {
            hasCriticalData = true;
          }

          for (const match of [...new Set(matches)]) {
            diffPreview.push({
              original: match,
              replacement: rule.replacement,
            });
          }

          anonymizedText = anonymizedText.replace(regex, rule.replacement);
        }
      } catch {
        // Invalid regex, skip this rule
        console.warn(`Invalid regex pattern for rule ${rule.name}: ${rule.pattern}`);
      }
    }

    return {
      anonymizedText,
      findings,
      diffPreview,
      hasCriticalData,
    };
  }

  async detectSensitiveData(
    instituteId: string,
    text: string,
  ): Promise<{ hasCriticalData: boolean; findings: AnonymizationFinding[] }> {
    const rules = await this.prisma.anonymizationRule.findMany({
      where: { instituteId, isEnabled: true, isCritical: true },
      orderBy: { sortOrder: 'asc' },
    });

    const findings: AnonymizationFinding[] = [];
    let hasCriticalData = false;

    for (const rule of rules) {
      try {
        const regex = new RegExp(rule.pattern, 'gi');
        const matches = text.match(regex) || [];

        if (matches.length > 0) {
          hasCriticalData = true;
          findings.push({
            type: rule.name,
            count: matches.length,
            matches: [...new Set(matches)].slice(0, 5),
          });
        }
      } catch {
        // Invalid regex, skip
      }
    }

    return { hasCriticalData, findings };
  }
}
