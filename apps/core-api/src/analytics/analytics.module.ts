import { Module } from '@nestjs/common';
import { AnalyticsSchedulerService } from './analytics-scheduler.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsSchedulerService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
