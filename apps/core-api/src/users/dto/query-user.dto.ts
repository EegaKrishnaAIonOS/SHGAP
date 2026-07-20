import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryUserDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive search over name or phone',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
