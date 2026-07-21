import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { NotificationServiceProvider } from './sms/notification-service.provider';
import { SMS_PROVIDER } from './sms/sms-provider.interface';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    JwtStrategy,
    // Real OTP delivery goes through notification-service (T13); see
    // ConsoleSmsProvider for the dependency-free dev/test fallback this
    // superseded — swap back to it directly if running core-api standalone
    // without notification-service available.
    { provide: SMS_PROVIDER, useClass: NotificationServiceProvider },
  ],
  exports: [AuthService],
})
export class AuthModule {}
