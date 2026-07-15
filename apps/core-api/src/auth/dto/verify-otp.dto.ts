import { ApiProperty } from '@nestjs/swagger';
import { Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: '9876543210' })
  @Matches(/^[6-9]\d{9}$/, {
    message:
      'phone must be a valid 10-digit Indian mobile number (e.g. 9876543210)',
  })
  phone: string;

  @ApiProperty({ example: '123456' })
  @Length(4, 8)
  @Matches(/^\d+$/, { message: 'otp must be numeric' })
  otp: string;
}
