import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { ConsoleSmsProvider } from './sms/console-sms.provider';
import { SMS_PROVIDER } from './sms/sms-provider.interface';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    JwtStrategy,
    { provide: SMS_PROVIDER, useClass: ConsoleSmsProvider },
  ],
  exports: [AuthService],
})
export class AuthModule {}
