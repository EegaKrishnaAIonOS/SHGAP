import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { PreferredLanguage } from '@shgap/database';

export class CreateUserDto {
  @ApiProperty({ example: '9876543210' })
  @Matches(/^[6-9]\d{9}$/, {
    message: 'phone must be a valid 10-digit Indian mobile number',
  })
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: ['TELUGU', 'ENGLISH'] })
  @IsOptional()
  @IsIn(['TELUGU', 'ENGLISH'])
  preferredLanguage?: PreferredLanguage;
}
