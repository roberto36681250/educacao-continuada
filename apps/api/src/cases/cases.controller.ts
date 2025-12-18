import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CasesService } from './cases.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('cases')
@UseGuards(JwtAuthGuard)
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  async findAll(@Request() req: any) {
    return this.casesService.findAll(req.user.instituteId, req.user.role);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.casesService.findOne(id, req.user.instituteId, req.user.role);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async create(
    @Body() body: { title: string; textAnonymized?: string },
    @Request() req: any,
  ) {
    return this.casesService.create(
      req.user.instituteId,
      req.user.userId,
      body,
    );
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async update(
    @Param('id') id: string,
    @Body() body: { title?: string; textAnonymized?: string },
    @Request() req: any,
  ) {
    return this.casesService.update(id, req.user.instituteId, body);
  }

  @Post(':id/anonymize')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async anonymize(
    @Param('id') id: string,
    @Body() body: { rawText: string },
    @Request() req: any,
  ) {
    return this.casesService.anonymize(
      id,
      req.user.instituteId,
      req.user.userId,
      body.rawText,
    );
  }

  @Patch(':id/publish')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async publish(@Param('id') id: string, @Request() req: any) {
    return this.casesService.publish(
      id,
      req.user.instituteId,
      req.user.userId,
    );
  }

  @Patch(':id/archive')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async archive(@Param('id') id: string, @Request() req: any) {
    return this.casesService.archive(
      id,
      req.user.instituteId,
      req.user.userId,
    );
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN')
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.casesService.delete(id, req.user.instituteId);
  }
}
