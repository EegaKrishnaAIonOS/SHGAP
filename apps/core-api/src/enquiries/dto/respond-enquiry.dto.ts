import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

/** Only `RESPONDED`/`CLOSED` — `OPEN` is the enquiry's own initial default;
 * re-opening one isn't what "responding" means. */
export class RespondEnquiryDto {
  @ApiProperty({ enum: ['RESPONDED', 'CLOSED'] })
  @IsIn(['RESPONDED', 'CLOSED'])
  status: 'RESPONDED' | 'CLOSED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  responseMessage?: string;
}