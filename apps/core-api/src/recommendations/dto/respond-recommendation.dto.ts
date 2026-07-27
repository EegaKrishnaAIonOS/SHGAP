import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

const RESPONSE_STATUSES = ['ACCEPTED', 'REJECTED'] as const;
export type RecommendationResponseStatus = (typeof RESPONSE_STATUSES)[number];

export class RespondRecommendationDto {
  @ApiProperty({ enum: RESPONSE_STATUSES })
  @IsIn(RESPONSE_STATUSES)
  status: RecommendationResponseStatus;
}
