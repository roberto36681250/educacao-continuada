import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InvitesService } from './invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('invites')
export class InvitesController {
  constructor(private invitesService: InvitesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN_MASTER, UserRole.ADMIN)
  async create(@Body() dto: CreateInviteDto, @Request() req: any) {
    return this.invitesService.create(dto, req.user.id);
  }

  @Get(':token')
  async findByToken(@Param('token') token: string) {
    return this.invitesService.findByToken(token);
  }

  @Post(':token/accept')
  async accept(
    @Param('token') token: string,
    @Body() dto: AcceptInviteDto,
  ) {
    return this.invitesService.accept(token, dto);
  }
}
