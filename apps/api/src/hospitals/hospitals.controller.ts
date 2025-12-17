import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { HospitalsService } from './hospitals.service';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { UpdateHospitalDto } from './dto/update-hospital.dto';

@Controller('hospitals')
@UseGuards(JwtAuthGuard)
export class HospitalsController {
  constructor(private hospitalsService: HospitalsService) {}

  @Get()
  findByInstitute(@Query('instituteId') instituteId: string) {
    return this.hospitalsService.findByInstitute(instituteId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hospitalsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_MASTER)
  create(@Body() dto: CreateHospitalDto) {
    return this.hospitalsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_MASTER)
  update(@Param('id') id: string, @Body() dto: UpdateHospitalDto) {
    return this.hospitalsService.update(id, dto);
  }
}
