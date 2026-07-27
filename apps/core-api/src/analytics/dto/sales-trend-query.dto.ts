import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { AnalyticsFilterDto } from './analytics-filter.dto';

const BUCKETS = ['day', 'week', 'month'] as const;
export type SalesTrendBucket = (typeof BUCKETS)[number];

export class SalesTrendQueryDto extends AnalyticsFilterDto {
  @ApiPropertyOptional({ enum: BUCKETS, default: 'month' })
  @IsOptional()
  @IsIn(BUCKETS)
  bucket: SalesTrendBucket = 'month';
}
