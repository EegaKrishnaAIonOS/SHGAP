import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsPositive,
  Max,
} from 'class-validator';

export class NearbyProductQueryDto {
  @ApiProperty({ example: 14.6819 })
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 77.6006 })
  @Type(() => Number)
  @IsLongitude()
  lng: number;

  @ApiPropertyOptional({
    default: 25,
    maximum: 200,
    description: 'Search radius in kilometres',
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Max(200)
  radiusKm: number = 25;
}
