import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length } from 'class-validator';

export class CreateUlbDto {
  @ApiProperty({ example: 'Anantapur Municipal Corporation' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'ATP-MC', description: 'Short unique ULB code' })
  @IsString()
  @Length(1, 15)
  code: string;

  @ApiProperty()
  @IsUUID()
  districtId: string;
}
