import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HospitalsService } from './hospitals.service';

@Controller('hospitals')
@UseGuards(JwtAuthGuard)
export class HospitalsController {
  constructor(private hospitalsService: HospitalsService) {}

  @Get()
  findByInstitute(@Query('instituteId') instituteId: string) {
    return this.hospitalsService.findByInstitute(instituteId);
  }
}
