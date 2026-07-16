import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    description:
      'The SHG this product belongs to — caller must own it (or be admin)',
  })
  @IsUUID()
  shgId: string;

  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiProperty({ example: 'Mango Pickle (500g jar)' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 'jar',
    description: 'Free-text unit of sale (kg, piece, jar, dozen, litre, ...)',
  })
  @IsString()
  unit: string;

  @ApiProperty({ example: 120.0 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiPropertyOptional({ default: 1, description: 'Minimum order quantity' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  moq?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({
    example: 14.6819,
    description:
      'Defaults to the SHG location if omitted; provide together with lng',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: 77.6006 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}
