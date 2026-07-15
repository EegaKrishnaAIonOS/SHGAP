import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { RoleName } from '@shgap/database';

const ROLE_NAMES: RoleName[] = [
  'SHG',
  'ULB_OFFICIAL',
  'DISTRICT_OFFICIAL',
  'STATE_OFFICIAL',
  'ADMIN',
];

export class AssignRoleDto {
  @ApiProperty({ enum: ROLE_NAMES })
  @IsIn(ROLE_NAMES)
  role: RoleName;

  @ApiPropertyOptional({
    description: 'Required for DISTRICT_OFFICIAL and ULB_OFFICIAL',
  })
  @IsOptional()
  @IsUUID()
  districtId?: string;

  @ApiPropertyOptional({ description: 'Required for ULB_OFFICIAL' })
  @IsOptional()
  @IsUUID()
  ulbId?: string;
}
