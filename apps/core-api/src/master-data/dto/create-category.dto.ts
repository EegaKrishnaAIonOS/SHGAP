import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Pickles' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'pickles', description: 'Unique URL-safe slug' })
  @IsString()
  slug: string;

  @ApiPropertyOptional({
    description: 'Omit for a top-level category group',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
