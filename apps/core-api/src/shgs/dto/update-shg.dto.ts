import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { CreateShgDto } from './create-shg.dto';

export class UpdateShgDto extends PartialType(CreateShgDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
