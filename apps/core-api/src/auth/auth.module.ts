import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConsoleMailProvider } from './mail/console-mail.provider';
import { MAIL_PROVIDER } from './mail/mail-provider.interface';
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
    // No real email gateway exists yet (T25) — logs the reset link instead
    // of sending it. Swap in a real implementation here once one exists.
    { provide: MAIL_PROVIDER, useClass: ConsoleMailProvider },
  ],
  exports: [AuthService],
})
export class AuthModule {}
