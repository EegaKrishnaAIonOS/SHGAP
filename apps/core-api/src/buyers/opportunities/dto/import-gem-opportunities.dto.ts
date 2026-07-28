import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateGemOpportunityDto } from './create-gem-opportunity.dto';

export class ImportGemOpportunitiesDto {
  @ApiProperty({ type: [CreateGemOpportunityDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateGemOpportunityDto)
  opportunities: CreateGemOpportunityDto[];
}
