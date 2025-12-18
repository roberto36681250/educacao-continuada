import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TemplateVariable {
  name: string;
  required: boolean;
  description?: string;
}

@Injectable()
export class EmailTemplateService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.emailTemplate.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async findByKey(key: string) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { key },
    });

    if (!template) {
      throw new NotFoundException(`Template ${key} não encontrado`);
    }

    return template;
  }

  async findActiveByKey(key: string) {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { key, isActive: true },
    });

    if (!template) {
      throw new NotFoundException(`Template ativo ${key} não encontrado`);
    }

    return template;
  }

  async create(data: {
    key: string;
    subject: string;
    htmlBody: string;
    textBody: string;
    variablesSchema: TemplateVariable[];
    createdByUserId?: string;
  }) {
    // Check if key already exists
    const existing = await this.prisma.emailTemplate.findUnique({
      where: { key: data.key },
    });

    if (existing) {
      throw new BadRequestException(`Template com key ${data.key} já existe`);
    }

    return this.prisma.emailTemplate.create({
      data: {
        key: data.key,
        subject: data.subject,
        htmlBody: data.htmlBody,
        textBody: data.textBody,
        variablesSchema: data.variablesSchema as any,
        createdByUserId: data.createdByUserId,
        version: 1,
      },
    });
  }

  async update(
    id: string,
    data: {
      subject?: string;
      htmlBody?: string;
      textBody?: string;
      variablesSchema?: TemplateVariable[];
      isActive?: boolean;
    },
  ) {
    const existing = await this.prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Template não encontrado');
    }

    // Increment version if content changed
    const contentChanged =
      data.subject !== undefined ||
      data.htmlBody !== undefined ||
      data.textBody !== undefined;

    return this.prisma.emailTemplate.update({
      where: { id },
      data: {
        ...data,
        variablesSchema: data.variablesSchema as any,
        version: contentChanged ? existing.version + 1 : existing.version,
      },
    });
  }

  renderTemplate(
    template: string,
    payload: Record<string, any>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (payload[key] !== undefined) {
        return String(payload[key]);
      }
      return match; // Keep placeholder if not found
    });
  }

  validatePayload(
    variablesSchema: TemplateVariable[],
    payload: Record<string, any>,
  ): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    for (const variable of variablesSchema) {
      if (variable.required && payload[variable.name] === undefined) {
        missing.push(variable.name);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }
}
