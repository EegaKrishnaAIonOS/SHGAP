import { ApiProperty } from '@nestjs/swagger';
import {
  Equals,
  IsEmail,
  IsIn,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Match } from '../../common/validators/match.decorator';

/** The only three roles a user can self-select at /auth/register — SHG
 * officials/ULB/DISTRICT/STATE_OFFICIAL/ADMIN are provisioned separately
 * (phone-OTP + admin assignment), never through this endpoint. */
export const SELF_REGISTERABLE_ROLES = [
  'SHG',
  'DISTRIBUTOR',
  'CONSUMER',
] as const;
export type SelfRegisterableRole = (typeof SELF_REGISTERABLE_ROLES)[number];

export class RegisterDto {
  @ApiProperty({ example: 'Lakshmi Devi' })
  @IsString()
  @MinLength(1, { message: 'Please enter your full name.' })
  fullName: string;

  @ApiProperty({ example: 'lakshmi@example.com' })
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  email: string;

  @ApiProperty({ example: '9876543210' })
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Please enter a valid mobile number.',
  })
  mobileNumber: string;

  @ApiProperty({ example: 'Str0ngPass!' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'Password must contain at least 8 characters, including an uppercase letter, a lowercase letter, a number, and a special character.',
  })
  password: string;

  @ApiProperty({ example: 'Str0ngPass!' })
  @Match('password', { message: 'Passwords do not match.' })
  confirmPassword: string;

  @ApiProperty({ enum: SELF_REGISTERABLE_ROLES })
  @IsIn(SELF_REGISTERABLE_ROLES, {
    message: 'role must be one of SHG, DISTRIBUTOR, CONSUMER.',
  })
  role: SelfRegisterableRole;

  @ApiProperty({ example: true })
  @Equals(true, { message: 'Please accept the Terms & Conditions.' })
  termsAccepted: boolean;
}
