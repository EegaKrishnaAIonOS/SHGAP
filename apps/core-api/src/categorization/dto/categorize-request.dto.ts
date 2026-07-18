import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CategorizeRequestDto {
  @ApiProperty({ example: 'Mango Pickle (500g jar)' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({
    example: 'Homemade spicy mango pickle with mustard oil',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
