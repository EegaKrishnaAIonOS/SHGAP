import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GemOpportunityStatus } from '@shgap/database';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export const GEM_OPPORTUNITY_STATUSES: GemOpportunityStatus[] = [
  'OPEN',
  'CLOSED',
  'AWARDED',
  'CANCELLED',
];

export class CreateGemOpportunityDto {
  @ApiProperty()
  @IsUUID()
  buyerId: string;

  @ApiPropertyOptional({
    description:
      'Matched against SHG products to trigger tender-opportunity alerts',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({ example: 'GEM/2026/B/1234567' })
  @IsString()
  referenceNumber: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantityRequired?: number;

  @ApiPropertyOptional({ example: 'kg' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedValue?: number;

  @ApiProperty({ example: '2026-09-30' })
  @IsDateString()
  submissionDeadline: string;

  @ApiPropertyOptional({ enum: GEM_OPPORTUNITY_STATUSES, default: 'OPEN' })
  @IsOptional()
  @IsIn(GEM_OPPORTUNITY_STATUSES)
  status?: GemOpportunityStatus;

  @ApiPropertyOptional({
    default: false,
    description:
      'True for seed/demo data; a real write through this API defaults to false — see ADR-0030',
  })
  @IsOptional()
  @IsBoolean()
  isSimulated?: boolean;
}
