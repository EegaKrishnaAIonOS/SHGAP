import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/** Shared drill-down filters every analytics endpoint accepts — district/ULB/
 * category narrow *which* rows count, dateFrom/dateTo narrow *when*. All
 * optional: omitting everything returns the caller's full scoped rollup.
 * Extends pagination too (unused page/pageSize on non-list endpoints is
 * harmless) so every analytics query DTO is this one shape, matching
 * QueryBuyerDto's convention (T16) of one combined query DTO per resource. */
export class AnalyticsFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  districtId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ulbId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Inclusive lower bound' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateFrom?: Date;

  @ApiPropertyOptional({ description: 'Inclusive upper bound' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateTo?: Date;
}
