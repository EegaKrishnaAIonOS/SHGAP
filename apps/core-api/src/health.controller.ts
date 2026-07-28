import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): { status: string; service: string; uptimeSeconds: number } {
    // `process.uptime()` is real (time since this process started), but it's
    // narrower than a true SLA uptime metric — it resets on every deploy or
    // restart. No monitoring stack exists yet to compute an actual uptime %
    // (ADR-0014's Prometheus/Grafana/Loki stack is Sprint 5/6 scope), so this
    // is reported honestly as "API service uptime", not fabricated as an SLA
    // figure the platform doesn't actually track.
    return {
      status: 'ok',
      service: 'core-api',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
