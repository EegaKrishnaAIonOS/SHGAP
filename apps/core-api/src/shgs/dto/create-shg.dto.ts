import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShgType } from '@shgap/database';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

const SHG_TYPES: ShgType[] = [
  'FOOD',
  'HANDICRAFTS',
  'HANDLOOM',
  'AGRICULTURE_ALLIED',
  'HOME_BASED_ENTERPRISE',
];

export class CreateShgDto {
  @ApiProperty({ example: 'Sri Lakshmi SHG' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'MEPMA registration number, if already registered',
  })
  @IsOptional()
  @IsString()
  mepmaRegistrationNumber?: string;

  @ApiProperty({ enum: SHG_TYPES })
  @IsIn(SHG_TYPES)
  type: ShgType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productionCapacityNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiPropertyOptional({ description: '11-character IFSC code' })
  @IsOptional()
  @IsString()
  @Length(11, 11)
  bankIfsc?: string;

  @ApiProperty({ description: 'Must be one of the 3 pilot districts' })
  @IsUUID()
  districtId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ulbId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  mandalId?: string;

  @ApiPropertyOptional({
    example: 14.6819,
    description:
      'Provide together with lng, or omit both — enforced in the service layer',
  })
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ example: 77.6006 })
  @IsOptional()
  @IsLongitude()
  lng?: number;
}
