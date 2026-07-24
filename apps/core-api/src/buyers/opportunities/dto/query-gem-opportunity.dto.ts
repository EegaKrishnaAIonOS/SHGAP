import { ApiPropertyOptional } from '@nestjs/swagger';
import { GemOpportunityStatus } from '@shgap/database';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const GEM_OPPORTUNITY_STATUSES: GemOpportunityStatus[] = [
  'OPEN',
  'CLOSED',
  'AWARDED',
  'CANCELLED',
];

export class QueryGemOpportunityDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  buyerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  districtId?: string;

  @ApiPropertyOptional({ enum: GEM_OPPORTUNITY_STATUSES })
  @IsOptional()
  @IsIn(GEM_OPPORTUNITY_STATUSES)
  status?: GemOpportunityStatus;
}
