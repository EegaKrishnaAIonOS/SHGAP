import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check(): { status: string; service: string } {
    return { status: 'ok', service: 'notification-service' };
  }

  /**
   * T24/ADR-0033: real readiness check against Postgres — this service's
   * one hard dependency for reading/writing `Notification` rows. BullMQ's
   * own Redis connection isn't gated here: a worker that can't reach Redis
   * simply stops picking up jobs (visible via `notification_jobs_total`
   * having no new samples, and BullMQ's own connection-retry logging) rather
   * than failing to serve a request, so it doesn't fit the same
   * "pull this pod out of rotation" semantics a Service readiness probe is
   * for.
   */
  @Get('ready')
  @ApiExcludeEndpoint()
  async ready(): Promise<{ status: string; checks: Record<string, boolean> }> {
    const checks: Record<string, boolean> = {};
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }

    if (!Object.values(checks).every(Boolean)) {
      throw new ServiceUnavailableException({ status: 'not_ready', checks });
    }
    return { status: 'ok', checks };
  }
}
