import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';

@Controller('lessons')
@UseGuards(JwtAuthGuard)
export class LessonsController {
  constructor(private lessonsService: LessonsService) {}

  @Get()
  findByModule(
    @Query('moduleId') moduleId: string,
    @Query('includeUnpublished') includeUnpublished?: string,
  ) {
    return this.lessonsService.findByModule(
      moduleId,
      includeUnpublished === 'true',
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const lesson = await this.lessonsService.findOne(id);
    // Registrar última aula acessada (async, não bloqueia resposta)
    this.lessonsService.recordLastSeen(id, req.user.userId).catch(() => {});
    return lesson;
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_MASTER, UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() dto: CreateLessonDto) {
    return this.lessonsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_MASTER, UserRole.ADMIN, UserRole.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateLessonDto) {
    return this.lessonsService.update(id, dto);
  }

  @Get(':id/progress')
  getProgress(@Param('id') id: string, @Request() req: any) {
    return this.lessonsService.getProgress(id, req.user.id);
  }

  @Post(':id/progress')
  updateProgress(
    @Param('id') id: string,
    @Body() dto: UpdateProgressDto,
    @Request() req: any,
  ) {
    return this.lessonsService.updateProgress(id, req.user.id, dto);
  }

  // ============================================
  // WORKFLOW EDITORIAL
  // ============================================

  @Get(':id/readiness')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_MASTER, UserRole.ADMIN, UserRole.MANAGER)
  getReadiness(@Param('id') id: string) {
    return this.lessonsService.getReadiness(id);
  }

  @Post(':id/recompute-readiness')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_MASTER, UserRole.ADMIN, UserRole.MANAGER)
  recomputeReadiness(@Param('id') id: string) {
    return this.lessonsService.recomputeReadiness(id);
  }

  @Post(':id/publish')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_MASTER, UserRole.ADMIN, UserRole.MANAGER)
  publishLesson(@Param('id') id: string, @Request() req: any) {
    const allowProfessorPublish = process.env.ALLOW_PROFESSOR_PUBLISH === 'true';
    return this.lessonsService.publishLesson(id, req.user.userId, req.user.role, allowProfessorPublish);
  }

  @Post(':id/duplicate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_MASTER, UserRole.ADMIN, UserRole.MANAGER)
  duplicateLesson(
    @Param('id') id: string,
    @Body() body: { targetModuleId: string; newTitle?: string },
    @Request() req: any,
  ) {
    return this.lessonsService.duplicateLesson(id, body.targetModuleId, body.newTitle, req.user.userId);
  }

  // ============================================
  // LOCK DE EDIÇÃO
  // ============================================

  @Get(':id/lock')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_MASTER, UserRole.ADMIN, UserRole.MANAGER)
  getLock(@Param('id') id: string) {
    return this.lessonsService.getLock(id);
  }

  @Post(':id/lock')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_MASTER, UserRole.ADMIN, UserRole.MANAGER)
  acquireLock(@Param('id') id: string, @Request() req: any) {
    return this.lessonsService.acquireLock(id, req.user.userId);
  }

  @Post(':id/unlock')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_MASTER, UserRole.ADMIN, UserRole.MANAGER)
  releaseLock(@Param('id') id: string, @Request() req: any) {
    return this.lessonsService.releaseLock(id, req.user.userId);
  }
}
