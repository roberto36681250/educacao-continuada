import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UnitsService {
  constructor(private prisma: PrismaService) {}

  async findByHospital(hospitalId: string) {
    return this.prisma.unit.findMany({
      where: { hospitalId },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
