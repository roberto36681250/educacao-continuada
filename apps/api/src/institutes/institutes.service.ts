import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InstitutesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.institute.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
