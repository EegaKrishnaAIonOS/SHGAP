import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  // T23/ADR-0032: the global 100-req/min-per-IP throttle (T22) starved this
  // endpoint under k6 load, which would make any real uptime monitor that
  // polls it see false 429 "downtime" — exactly the metric this endpoint
  // exists to report. Health checks must never be rate-limited.
  @SkipThrottle()
  @Get()
  check(): { status: string; service: string; uptimeSeconds: number } {
    // `process.uptime()` is real (time since this process started), but it's
    // narrower than a true SLA uptime metric — it resets on every deploy or
    // restart. A real uptime % is now derivable (T24/ADR-0033) from
    // Prometheus's own `up{job="core-api"}` series scraped off `/metrics`
    // over time, not from this field — this stays a plain liveness probe.
    return {
      status: 'ok',
      service: 'core-api',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  /**
   * T24/ADR-0033: a real readiness probe — checks the two dependencies this
   * service cannot serve a real request without, not just "did the process
   * start." Kubernetes' liveness/readiness split is the reason this is a
   * separate endpoint from `/health` above: a pod failing this should be
   * pulled out of the Service's load-balancing rotation (traffic redirected
   * elsewhere) but NOT killed/restarted the way a failed liveness probe
   * would — restarting a healthy process won't fix a downstream DB outage.
   */
  @Public()
  @SkipThrottle()
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

    try {
      checks.redis = (await this.redis.ping()) === 'PONG';
    } catch {
      checks.redis = false;
    }

    // 503 (not 200) on a failed check, so it actually behaves like "not
    // ready" to a real Kubernetes readiness probe or uptime monitor reading
    // the status code, not just the response body.
    if (!Object.values(checks).every(Boolean)) {
      throw new ServiceUnavailableException({ status: 'not_ready', checks });
    }
    return { status: 'ok', checks };
  }
}
