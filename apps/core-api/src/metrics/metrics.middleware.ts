import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

/**
 * Labels by the matched route pattern (`req.route.path`, e.g. `/shgs/:id`),
 * not the raw URL — using the raw path would give every distinct SHG id its
 * own time series (unbounded cardinality, the classic Prometheus footgun).
 * Falls back to `req.path` only for requests that never matched a route
 * (404s), which are low-volume enough not to matter.
 */
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      const route =
        (req.route as { path?: string } | undefined)?.path ?? req.path;
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };
      this.metrics.httpRequestDuration.observe(labels, durationSeconds);
      this.metrics.httpRequestsTotal.inc(labels);
    });
    next();
  }
}
