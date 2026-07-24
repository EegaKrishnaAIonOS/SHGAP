import { Module } from '@nestjs/common';
import { BuyersController } from './buyers.controller';
import { BuyersService } from './buyers.service';
import { GemOpportunitiesController } from './opportunities/gem-opportunities.controller';
import { GemOpportunitiesService } from './opportunities/gem-opportunities.service';

@Module({
  controllers: [BuyersController, GemOpportunitiesController],
  providers: [BuyersService, GemOpportunitiesService],
  exports: [BuyersService],
})
export class BuyersModule {}
