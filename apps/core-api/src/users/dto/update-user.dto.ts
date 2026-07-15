import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { PreferredLanguage, UserStatus } from '@shgap/database';

export class UpdateUserDto {
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

  @ApiPropertyOptional({
    enum: ['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'],
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'])
  status?: UserStatus;
}
