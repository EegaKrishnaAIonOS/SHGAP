import { Module } from '@nestjs/common';
import { NotificationDispatchClient } from '../common/notifications/notification-dispatch.client';
import { ConsentModule } from '../consent/consent.module';
import { BuyersController } from './buyers.controller';
import { BuyersService } from './buyers.service';
import { GemOpportunitiesController } from './opportunities/gem-opportunities.controller';
import { GemOpportunitiesService } from './opportunities/gem-opportunities.service';

@Module({
  imports: [ConsentModule],
  controllers: [BuyersController, GemOpportunitiesController],
  providers: [
    BuyersService,
    GemOpportunitiesService,
    NotificationDispatchClient,
  ],
  exports: [BuyersService],
})
export class BuyersModule {}
