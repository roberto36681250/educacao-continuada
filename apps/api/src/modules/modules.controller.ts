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
import { ModulesService } from './modules.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { LessonsService } from '../lessons/lessons.service';

@Controller('modules')
@UseGuards(JwtAuthGuard)
export class ModulesController {
  constructor(
    private modulesService: ModulesService,
    private lessonsService: LessonsService,
  ) {}

  @Get()
  findByCourse(
    @Query('courseId') courseId: string,
    @Query('includeUnpublished') includeUnpublished?: string,
  ) {
    return this.modulesService.findByCourse(
      courseId,
      includeUnpublished === 'true',
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.modulesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_MASTER, UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() dto: CreateModuleDto) {
    return this.modulesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_MASTER, UserRole.ADMIN, UserRole.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateModuleDto) {
    return this.modulesService.update(id, dto);
  }

  // ============================================
  // WORKFLOW EDITORIAL
  // ============================================

  @Post(':id/lessons/bulk')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_MASTER, UserRole.ADMIN, UserRole.MANAGER)
  createLessonsBulk(
    @Param('id') moduleId: string,
    @Body() body: { titles: string[] },
    @Request() req: any,
  ) {
    return this.lessonsService.createBulk(moduleId, body.titles, req.user.userId);
  }

  @Post(':id/publish')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_MASTER, UserRole.ADMIN, UserRole.MANAGER)
  publishModule(@Param('id') id: string, @Request() req: any) {
    return this.modulesService.publishModule(id, req.user.userId);
  }
}
