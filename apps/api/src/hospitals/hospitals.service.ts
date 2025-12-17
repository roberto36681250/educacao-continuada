import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { UpdateHospitalDto } from './dto/update-hospital.dto';

@Injectable()
export class HospitalsService {
  constructor(private prisma: PrismaService) {}

  async findByInstitute(instituteId: string) {
    return this.prisma.hospital.findMany({
      where: { instituteId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: { units: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id },
      include: {
        institute: { select: { id: true, name: true } },
        _count: { select: { units: true } },
      },
    });

    if (!hospital) {
      throw new NotFoundException('Hospital não encontrado');
    }

    return hospital;
  }

  async create(dto: CreateHospitalDto) {
    return this.prisma.hospital.create({
      data: {
        name: dto.name,
        instituteId: dto.instituteId,
      },
      select: {
        id: true,
        name: true,
        instituteId: true,
        createdAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateHospitalDto) {
    const existing = await this.prisma.hospital.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Hospital não encontrado');
    }

    return this.prisma.hospital.update({
      where: { id },
      data: { name: dto.name },
      select: {
        id: true,
        name: true,
        instituteId: true,
        createdAt: true,
      },
    });
  }
}
