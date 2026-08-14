import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { QueryMarketplaceProductsDto } from './dto/query-marketplace-products.dto';
import { MarketplaceService } from './marketplace.service';

/** Public (Phase 1, read-only) marketplace routes — every handler here is
 * `@Public()`, same mechanism as `/health`/ONDC's `on_search`. Kept as its
 * own controller/module rather than adding routes to `ProductsController`/
 * `ShgsController` so none of their existing authenticated behavior
 * changes. */
@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Public product category taxonomy' })
  categories() {
    return this.marketplace.categories();
  }

  @Public()
  @Get('districts')
  @ApiOperation({ summary: 'Public district list, for filtering the marketplace' })
  districts() {
    return this.marketplace.districts();
  }

  @Public()
  @Get('products')
  @ApiOperation({
    summary: 'Browse available products, paginated and filterable',
  })
  listProducts(@Query() query: QueryMarketplaceProductsDto) {
    return this.marketplace.listProducts(query);
  }

  @Public()
  @Get('products/:id')
  @ApiOperation({ summary: 'Get a single product by id' })
  getProduct(@Param('id') id: string) {
    return this.marketplace.getProduct(id);
  }

  @Public()
  @Get('shgs/:id')
  @ApiOperation({
    summary:
      "An SHG's public storefront: public-safe profile (no PII) plus its available products",
  })
  getStorefront(@Param('id') id: string) {
    return this.marketplace.getStorefront(id);
  }
}