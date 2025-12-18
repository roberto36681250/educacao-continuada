import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
    worker?: { status: 'ok' | 'unknown' | 'error'; lastHeartbeat?: string; queueStats?: any };
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async getHealth(): Promise<HealthStatus> {
    const dbCheck = await this.checkDatabase();

    const overallStatus =
      dbCheck.status === 'ok' ? 'ok' : 'degraded';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks: {
        database: dbCheck,
      },
    };
  }

  async getDetailedHealth(): Promise<HealthStatus> {
    const [dbCheck, workerCheck] = await Promise.all([
      this.checkDatabase(),
      this.checkWorker(),
    ]);

    const overallStatus =
      dbCheck.status === 'ok' && workerCheck.status !== 'error'
        ? 'ok'
        : dbCheck.status === 'error'
          ? 'error'
          : 'degraded';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks: {
        database: dbCheck,
        worker: workerCheck,
      },
    };
  }

  private async checkDatabase(): Promise<{
    status: 'ok' | 'error';
    latencyMs?: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        latencyMs: Date.now() - start,
      };
    } catch (error: any) {
      this.logger.error('Database health check failed', error);
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  private async checkWorker(): Promise<{
    status: 'ok' | 'unknown' | 'error';
    lastHeartbeat?: string;
    queueStats?: any;
  }> {
    try {
      // Check email queue stats as proxy for worker health
      const [pending, sending, failed] = await Promise.all([
        this.prisma.emailOutbox.count({ where: { status: 'PENDING' } }),
        this.prisma.emailOutbox.count({ where: { status: 'SENDING' } }),
        this.prisma.emailOutbox.count({ where: { status: 'FAILED' } }),
      ]);

      // Check if there are stuck SENDING emails (older than 5 minutes)
      const stuckCount = await this.prisma.emailOutbox.count({
        where: {
          status: 'SENDING',
          updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
        },
      });

      const status = stuckCount > 0 ? 'error' : 'ok';

      return {
        status,
        queueStats: { pending, sending, failed, stuck: stuckCount },
      };
    } catch (error: any) {
      return {
        status: 'unknown',
      };
    }
  }
}
