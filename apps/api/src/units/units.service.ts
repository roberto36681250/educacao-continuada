import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitsService {
  constructor(private prisma: PrismaService) {}

  async findByHospital(hospitalId: string) {
    return this.prisma.unit.findMany({
      where: { hospitalId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        hospital: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        hospital: {
          select: { id: true, name: true, instituteId: true },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException('Unidade não encontrada');
    }

    return unit;
  }

  async create(dto: CreateUnitDto) {
    return this.prisma.unit.create({
      data: {
        name: dto.name,
        hospitalId: dto.hospitalId,
      },
      select: {
        id: true,
        name: true,
        hospitalId: true,
        createdAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateUnitDto) {
    const existing = await this.prisma.unit.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Unidade não encontrada');
    }

    return this.prisma.unit.update({
      where: { id },
      data: { name: dto.name },
      select: {
        id: true,
        name: true,
        hospitalId: true,
        createdAt: true,
      },
    });
  }
}
