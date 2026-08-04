import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as client from 'prom-client';

/**
 * T24/ADR-0033: real Prometheus instrumentation, not a stub — this is the
 * first metric this platform has ever exposed (ADR-0014 named the stack,
 * deferred building it to T24). One shared `Registry` per process, with
 * Node's own default metrics (event loop lag, GC, memory, handles) plus a
 * hand-rolled HTTP request histogram/counter, since `prom-client` has no
 * Express/Nest-specific middleware built in.
 */
@Injectable()
export class MetricsService implements OnModuleDestroy {
  readonly registry = new client.Registry();

  readonly httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  readonly httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry],
  });

  constructor() {
    client.collectDefaultMetrics({ register: this.registry });
  }

  onModuleDestroy(): void {
    this.registry.clear();
  }
}
