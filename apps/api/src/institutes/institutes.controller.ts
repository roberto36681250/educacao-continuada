import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { InstitutesService } from './institutes.service';

@Controller('institutes')
@UseGuards(JwtAuthGuard)
export class InstitutesController {
  constructor(private institutesService: InstitutesService) {}

  @Get()
  findAll() {
    return this.institutesService.findAll();
  }
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private institutesService: InstitutesService) {}

  @Get()
  @Roles(UserRole.ADMIN_MASTER, UserRole.ADMIN, UserRole.MANAGER)
  findByInstitute(@Query('instituteId') instituteId: string) {
    return this.institutesService.findUsersByInstitute(instituteId);
  }
}
