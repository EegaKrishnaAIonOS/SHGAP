import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  // require_tld: false — internal officials/admin accounts (e.g.
  // admin@technical) are provisioned with a short, TLD-less identifier
  // rather than a real mailbox.
  @ApiProperty({ example: 'lakshmi@example.com' })
  @IsEmail(
    { require_tld: false },
    { message: 'Please enter a valid email address.' },
  )
  email: string;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiPropertyOptional({
    description:
      'Extends the refresh-token lifetime beyond the default session TTL (see AuthService.loginWithPassword).',
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
