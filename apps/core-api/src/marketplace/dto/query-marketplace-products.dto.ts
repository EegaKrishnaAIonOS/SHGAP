import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export const MARKETPLACE_SORT_OPTIONS = ['newest', 'price_asc', 'price_desc'] as const;
export type MarketplaceSortBy = (typeof MARKETPLACE_SORT_OPTIONS)[number];

/** Same filter shape as `QueryProductDto`, minus `isAvailable` — the public
 * marketplace always restricts to available products (see
 * `ProductsService.findAllPublic`), so there's nothing for a caller to
 * override. */
export class QueryMarketplaceProductsDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  districtId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  shgId?: string;

  @ApiPropertyOptional({
    description: 'Case-insensitive search over the product name or description',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: MARKETPLACE_SORT_OPTIONS, default: 'newest' })
  @IsOptional()
  @IsIn(MARKETPLACE_SORT_OPTIONS)
  sortBy?: MarketplaceSortBy;
}