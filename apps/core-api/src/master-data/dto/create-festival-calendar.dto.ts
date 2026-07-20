import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateFestivalCalendarDto {
  @ApiProperty({ example: 'Sankranti' })
  @IsString()
  name: string;

  @ApiProperty({ example: '2027-01-14' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2027-01-16' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Whether this recurs every year on the same dates',
  })
  @IsOptional()
  @IsBoolean()
  recurring?: boolean;

  @ApiPropertyOptional({
    description: 'Omit for a statewide festival/season marker',
  })
  @IsOptional()
  @IsUUID()
  districtId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
