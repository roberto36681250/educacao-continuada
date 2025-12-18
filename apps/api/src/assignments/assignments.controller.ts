import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  // ============================================
  // GESTOR ENDPOINTS
  // ============================================

  @Post('assignments')
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async createAssignment(
    @Body() dto: CreateAssignmentDto,
    @Request() req: any,
  ) {
    return this.assignmentsService.createAssignment(
      dto,
      req.user.id,
      req.user.instituteId,
    );
  }

  @Get('assignments')
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async listAssignments(
    @Request() req: any,
    @Query('courseId') courseId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.assignmentsService.listAssignments(req.user.instituteId, {
      courseId,
      from,
      to,
    });
  }

  @Get('assignments/:id')
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async getAssignmentDetails(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.assignmentsService.getAssignmentDetails(id, req.user.instituteId);
  }

  @Get('rankings')
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async getRankings(
    @Request() req: any,
    @Query('type') type: 'UNIT_ALL' | 'INSTITUTE_PROFESSION' | 'UNIT_PROFESSION',
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('unitId') unitId?: string,
  ) {
    return this.assignmentsService.getRankings(
      req.user.instituteId,
      type,
      from,
      to,
      unitId,
    );
  }

  // ============================================
  // ALUNO ENDPOINTS
  // ============================================

  @Get('me/assignments')
  async getMyAssignments(
    @Request() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.assignmentsService.getMyAssignments(req.user.id, from, to);
  }

  @Get('me/assignments/:id')
  async getMyAssignmentDetails(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.assignmentsService.getMyAssignmentDetails(req.user.id, id);
  }

  @Post('me/assignments/:id/recompute')
  async recomputeMyStatus(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.assignmentsService.recomputeMyStatus(req.user.id, id);
  }
}
