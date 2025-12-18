import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ContentManagementService } from './content-management.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('gestor')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContentManagementController {
  constructor(private readonly contentService: ContentManagementService) {}

  @Get('export/course/:courseId')
  @Roles('ADMIN_MASTER', 'MANAGER')
  async exportCourse(
    @Param('courseId') courseId: string,
    @Request() req: any,
  ) {
    return this.contentService.exportCourse(
      courseId,
      req.user.instituteId,
      req.user.id,
    );
  }

  @Post('import/course')
  @Roles('ADMIN_MASTER', 'MANAGER')
  async importCourse(
    @Body() body: { payload: any; mode: 'DRY_RUN' | 'APPLY' },
    @Request() req: any,
  ) {
    return this.contentService.importCourse(
      body.payload,
      req.user.instituteId,
      req.user.id,
      body.mode,
    );
  }
}

@Controller('courses')
@UseGuards(JwtAuthGuard)
export class CourseVersionController {
  constructor(private readonly contentService: ContentManagementService) {}

  @Patch(':id/publish')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_MASTER', 'MANAGER')
  async publishCourse(@Param('id') id: string, @Request() req: any) {
    return this.contentService.publishCourse(
      id,
      req.user.instituteId,
      req.user.id,
    );
  }

  @Get(':id/versions')
  @UseGuards(RolesGuard)
  @Roles('ADMIN_MASTER', 'ADMIN', 'MANAGER')
  async getCourseVersions(@Param('id') id: string, @Request() req: any) {
    return this.contentService.getCourseVersions(id, req.user.instituteId);
  }
}
