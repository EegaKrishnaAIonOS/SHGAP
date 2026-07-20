import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShgType } from '@shgap/database';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const SHG_TYPES: ShgType[] = [
  'FOOD',
  'HANDICRAFTS',
  'HANDLOOM',
  'AGRICULTURE_ALLIED',
  'HOME_BASED_ENTERPRISE',
];

export class QueryShgDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  districtId?: string;

  @ApiPropertyOptional({ enum: SHG_TYPES })
  @IsOptional()
  @IsIn(SHG_TYPES)
  type?: ShgType;

  @ApiPropertyOptional({
    description: 'Case-insensitive search over the SHG name',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
