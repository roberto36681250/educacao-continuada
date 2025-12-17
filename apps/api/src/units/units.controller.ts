import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UnitsService } from './units.service';

@Controller('units')
@UseGuards(JwtAuthGuard)
export class UnitsController {
  constructor(private unitsService: UnitsService) {}

  @Get()
  findByHospital(@Query('hospitalId') hospitalId: string) {
    return this.unitsService.findByHospital(hospitalId);
  }
}
