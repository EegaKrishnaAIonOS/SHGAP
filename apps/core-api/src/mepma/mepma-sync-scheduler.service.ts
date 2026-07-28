import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { MepmaSyncService } from './mepma-sync.service';

/**
 * Same pattern as T18's `AnalyticsSchedulerService`: `SchedulerRegistry.
 * addInterval` (not `@Interval()`) because the interval must come from a
 * runtime config value, not a compile-time constant. Default is daily —
 * a government registry doesn't churn often enough to justify T18's
 * 15-minute cadence.
 */
@Injectable()
export class MepmaSyncSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(MepmaSyncSchedulerService.name);

  constructor(
    private readonly mepmaSyncService: MepmaSyncService,
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const intervalMinutes = Number(
      this.config.get<string>('MEPMA_SYNC_INTERVAL_MINUTES', String(24 * 60)),
    );

    const interval = setInterval(
      () => {
        this.sync();
      },
      intervalMinutes * 60 * 1000,
    );
    this.schedulerRegistry.addInterval('mepma-shg-sync', interval);
  }

  private async sync(): Promise<void> {
    try {
      const result = await this.mepmaSyncService.syncShgRegistry();
      this.logger.log(
        `Scheduled MEPMA SHG sync completed: ${result.linkedExisting} linked, ` +
          `${result.backfilledRegistrationNumber} backfilled, ${result.unmatched.length} unmatched`,
      );
    } catch (err) {
      // Same reasoning as AnalyticsSchedulerService — a scheduled job must
      // never crash the process.
      this.logger.error(
        `Scheduled MEPMA SHG sync failed: ${(err as Error).message}`,
      );
    }
  }
}
