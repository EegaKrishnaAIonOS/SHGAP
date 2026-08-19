import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { Match } from '../../common/validators/match.decorator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'The plaintext token from the reset link' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'N3wStr0ngPass!' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'Password must contain at least 8 characters, including an uppercase letter, a lowercase letter, a number, and a special character.',
  })
  newPassword: string;

  @ApiProperty({ example: 'N3wStr0ngPass!' })
  @Match('newPassword', { message: 'Passwords do not match.' })
  confirmPassword: string;
}
