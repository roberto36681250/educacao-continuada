import { Controller, Get, UseGuards } from '@nestjs/common';
import { HealthService } from './health.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Basic health check - public, fast
   * Used by load balancers and simple uptime monitors
   */
  @Get()
  async health() {
    return this.healthService.getHealth();
  }

  /**
   * Detailed health check - admin only
   * Includes worker status and queue stats
   */
  @Get('detailed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_MASTER')
  async detailedHealth() {
    return this.healthService.getDetailedHealth();
  }
}
