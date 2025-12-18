import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { HomeService } from './home.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller()
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get('me/home')
  @UseGuards(JwtAuthGuard)
  async getHomeData(@Request() req: any) {
    return this.homeService.getHomeData(
      req.user.userId,
      req.user.instituteId,
      req.user.role,
    );
  }
}
