import { Module } from '@nestjs/common';
import { AnalyticsSchedulerService } from './analytics-scheduler.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { MarketPricesService } from './market-prices.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsSchedulerService, MarketPricesService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
