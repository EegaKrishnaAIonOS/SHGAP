import { Module } from '@nestjs/common';
import { MasterDataModule } from '../master-data/master-data.module';
import { ProductsModule } from '../products/products.module';
import { ShgsModule } from '../shgs/shgs.module';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [ProductsModule, ShgsModule, MasterDataModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
})
export class MarketplaceModule {}