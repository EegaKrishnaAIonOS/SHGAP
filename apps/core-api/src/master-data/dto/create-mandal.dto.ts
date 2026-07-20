import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length } from 'class-validator';

export class CreateMandalDto {
  @ApiProperty({ example: 'Anantapur Rural' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'ATP-R01', description: 'Short unique mandal code' })
  @IsString()
  @Length(1, 15)
  code: string;

  @ApiProperty()
  @IsUUID()
  districtId: string;
}
