import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AnalyticsService } from './analytics.service';

/**
 * The first scheduled/periodic job in core-api (ml-services has used
 * APScheduler since T14; this is its NestJS equivalent for T18). The
 * interval is read via `ConfigService.get()` with a default rather than
 * added to the strict `EnvironmentVariables` validator (env.validation.ts)
 * — every field there is required with no default, and a materialized-view
 * refresh cadence is a soft tuning knob, not something a fresh environment
 * should fail to boot without. See ADR-0027.
 *
 * `SchedulerRegistry.addInterval` (not the `@Interval()` decorator) because
 * the interval decorator's value must be a compile-time constant — it can't
 * read a runtime-resolved config value.
 */
@Injectable()
export class AnalyticsSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsSchedulerService.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const intervalMinutes = Number(
      this.config.get<string>('ANALYTICS_REFRESH_INTERVAL_MINUTES', '15'),
    );

    const interval = setInterval(
      () => {
        this.refresh();
      },
      intervalMinutes * 60 * 1000,
    );
    this.schedulerRegistry.addInterval('analytics-view-refresh', interval);
  }

  private async refresh(): Promise<void> {
    try {
      await this.analyticsService.refreshViews();
      this.logger.log(
        'Scheduled analytics materialized view refresh completed',
      );
    } catch (err) {
      // A scheduled job must never crash the process — same reasoning as
      // ml-services' APScheduler jobs (T14/T15/T17).
      this.logger.error(
        `Scheduled analytics view refresh failed: ${(err as Error).message}`,
      );
    }
  }
}
