import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
