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
import { AnonymizationRulesService } from './anonymization-rules.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('anonymization-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnonymizationRulesController {
  constructor(private readonly rulesService: AnonymizationRulesService) {}

  @Get()
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async findAll(@Request() req: any) {
    return this.rulesService.findAll(req.user.instituteId);
  }

  @Get(':id')
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.rulesService.findOne(id, req.user.instituteId);
  }

  @Post()
  @Roles('ADMIN_MASTER', 'ADMIN')
  async create(
    @Body()
    body: {
      name: string;
      pattern: string;
      replacement: string;
      isEnabled?: boolean;
      isCritical?: boolean;
    },
    @Request() req: any,
  ) {
    return this.rulesService.create(req.user.instituteId, body);
  }

  @Patch(':id')
  @Roles('ADMIN_MASTER', 'ADMIN')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      pattern?: string;
      replacement?: string;
      isEnabled?: boolean;
      isCritical?: boolean;
      sortOrder?: number;
    },
    @Request() req: any,
  ) {
    return this.rulesService.update(id, req.user.instituteId, body);
  }

  @Delete(':id')
  @Roles('ADMIN_MASTER', 'ADMIN')
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.rulesService.remove(id, req.user.instituteId);
  }
}
