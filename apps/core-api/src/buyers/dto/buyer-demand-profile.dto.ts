import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

const DEMAND_FREQUENCIES = [
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'SEASONAL',
  'ONE_OFF',
] as const;

/** Structured shape for `Buyer.demandProfile` (typical volumes, frequency, price bands) —
 * validated like any other input rather than accepted as an untyped JSON blob. */
export class BuyerDemandProfileDto {
  @ApiPropertyOptional({
    description: 'Typical order volume, in the unit below',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  typicalVolume?: number;

  @ApiPropertyOptional({
    example: 'kg',
    description: 'Free-text unit for typicalVolume',
  })
  @IsOptional()
  @IsString()
  volumeUnit?: string;

  @ApiPropertyOptional({ enum: DEMAND_FREQUENCIES })
  @IsOptional()
  @IsIn(DEMAND_FREQUENCIES)
  frequency?: (typeof DEMAND_FREQUENCIES)[number];

  @ApiPropertyOptional({
    description: 'Lower bound of the price band this buyer typically pays',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  priceBandMin?: number;

  @ApiPropertyOptional({
    description: 'Upper bound of the price band this buyer typically pays',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  priceBandMax?: number;
}
