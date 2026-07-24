import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BuyerType } from '@shgap/database';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { BuyerDemandProfileDto } from './buyer-demand-profile.dto';

export const BUYER_TYPES: BuyerType[] = [
  'INSTITUTIONAL',
  'RETAIL',
  'BULK',
  'GOVERNMENT_PROCUREMENT',
];

export class CreateBuyerDto {
  @ApiProperty({ example: 'AP State Handicrafts Emporium' })
  @IsString()
  name: string;

  @ApiProperty({ enum: BUYER_TYPES })
  @IsIn(BUYER_TYPES)
  type: BuyerType;

  @ApiPropertyOptional({
    description: 'Parent organization/department, if applicable',
  })
  @IsOptional()
  @IsString()
  organization?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  districtId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Category ids this buyer is interested in',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ type: BuyerDemandProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BuyerDemandProfileDto)
  demandProfile?: BuyerDemandProfileDto;

  @ApiPropertyOptional({
    example: 16.5062,
    description: 'Provide together with lng, or omit both',
  })
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ example: 80.648 })
  @IsOptional()
  @IsLongitude()
  lng?: number;
}
