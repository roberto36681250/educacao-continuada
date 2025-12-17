import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HospitalsService {
  constructor(private prisma: PrismaService) {}

  async findByInstitute(instituteId: string) {
    return this.prisma.hospital.findMany({
      where: { instituteId },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
