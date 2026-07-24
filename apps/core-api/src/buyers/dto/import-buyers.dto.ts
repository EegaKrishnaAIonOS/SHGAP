import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateBuyerDto } from './create-buyer.dto';

export class ImportBuyersDto {
  @ApiProperty({ type: [CreateBuyerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateBuyerDto)
  buyers: CreateBuyerDto[];
}
