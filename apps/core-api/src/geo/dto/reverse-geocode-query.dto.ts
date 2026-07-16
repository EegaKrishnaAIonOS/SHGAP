import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude } from 'class-validator';

export class ReverseGeocodeQueryDto {
  @ApiProperty({ example: 14.6819 })
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 77.6006 })
  @Type(() => Number)
  @IsLongitude()
  lng: number;
}
