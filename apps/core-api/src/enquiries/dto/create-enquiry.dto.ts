import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateEnquiryDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({
    description:
      "Only used to seed the caller's buyer profile the first time they submit an RFQ — ignored on every later call.",
  })
  @IsOptional()
  @IsString()
  buyerName?: string;
}