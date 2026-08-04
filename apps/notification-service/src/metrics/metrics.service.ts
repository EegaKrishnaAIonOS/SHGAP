import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as client from 'prom-client';

/**
 * T24/ADR-0033: real Prometheus instrumentation (see core-api's identical
 * module for the full rationale — this mirrors it). One addition specific
 * to this service: a job-outcome counter, since notification-service's most
 * operationally important signal isn't HTTP traffic (it barely has any —
 * `POST /notifications/dispatch` is its only real route) but whether queued
 * SMS/WhatsApp/voice/email jobs actually succeed against real providers.
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

  readonly notificationJobsTotal = new client.Counter({
    name: 'notification_jobs_total',
    help: 'Total notification queue jobs processed, by channel and outcome',
    labelNames: ['channel', 'outcome'],
    registers: [this.registry],
  });

  constructor() {
    client.collectDefaultMetrics({ register: this.registry });
  }

  onModuleDestroy(): void {
    this.registry.clear();
  }
}
