import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('exposes real Prometheus exposition-format output, including default Node metrics', async () => {
    const service = new MetricsService();

    const output = await service.registry.metrics();

    expect(output).toContain('http_request_duration_seconds');
    expect(output).toContain('http_requests_total');
    // collectDefaultMetrics() output — proves it's actually wired up, not
    // just this service's own two hand-rolled metrics.
    expect(output).toContain('process_cpu_user_seconds_total');
  });

  it('records observations against the labels passed in, not silently dropping them', async () => {
    const service = new MetricsService();

    service.httpRequestDuration.observe(
      { method: 'GET', route: '/shgs/:id', status_code: '200' },
      0.042,
    );
    service.httpRequestsTotal.inc({
      method: 'GET',
      route: '/shgs/:id',
      status_code: '200',
    });

    const output = await service.registry.metrics();
    expect(output).toContain('route="/shgs/:id"');
    expect(output).toContain('status_code="200"');
  });
});
