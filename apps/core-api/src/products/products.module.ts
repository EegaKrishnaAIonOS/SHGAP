import { Module } from '@nestjs/common';
import { ProductImagesService } from './images/product-images.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductImagesService],
  exports: [ProductsService],
})
export class ProductsModule {}
