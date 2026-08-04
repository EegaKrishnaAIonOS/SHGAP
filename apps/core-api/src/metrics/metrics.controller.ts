import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

/**
 * Prometheus scrape target. `@Public()` (Prometheus never carries a bearer
 * token) and `@SkipThrottle()` — same reasoning as T23/ADR-0032's `/health`
 * fix: a scraper polling every 10-15s must never be rate-limited, or the
 * monitoring stack silently loses data under the exact load conditions
 * anyone would want to be watching for. Excluded from Swagger (not a
 * consumer-facing API, and its plaintext-exposition-format response would
 * just be noise in the OpenAPI doc).
 */
@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @SkipThrottle()
  @Get()
  async scrape(@Res() res: Response): Promise<void> {
    res.set('Content-Type', this.metrics.registry.contentType);
    res.send(await this.metrics.registry.metrics());
  }
}
