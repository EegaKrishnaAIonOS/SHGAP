import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateDistrictDto {
  @ApiProperty({ example: 'Anantapur' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'ATP', description: 'Short unique district code' })
  @IsString()
  @Length(1, 10)
  code: string;
}
