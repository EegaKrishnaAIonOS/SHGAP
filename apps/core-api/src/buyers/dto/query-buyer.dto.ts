import { ApiPropertyOptional } from '@nestjs/swagger';
import { BuyerType } from '@shgap/database';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { BUYER_TYPES } from './create-buyer.dto';

export class QueryBuyerDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BUYER_TYPES })
  @IsOptional()
  @IsIn(BUYER_TYPES)
  type?: BuyerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  districtId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Case-insensitive search over the buyer name',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
