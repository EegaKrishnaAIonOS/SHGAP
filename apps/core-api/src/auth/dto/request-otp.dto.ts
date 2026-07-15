import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({
    example: '9876543210',
    description: '10-digit Indian mobile number, no country code',
  })
  @Matches(/^[6-9]\d{9}$/, {
    message:
      'phone must be a valid 10-digit Indian mobile number (e.g. 9876543210)',
  })
  phone: string;
}
