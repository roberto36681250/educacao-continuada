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
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Controller('units')
@UseGuards(JwtAuthGuard)
export class UnitsController {
  constructor(private unitsService: UnitsService) {}

  @Get()
  findByHospital(@Query('hospitalId') hospitalId: string) {
    return this.unitsService.findByHospital(hospitalId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.unitsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_MASTER)
  create(@Body() dto: CreateUnitDto) {
    return this.unitsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_MASTER)
  update(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
    return this.unitsService.update(id, dto);
  }
}
