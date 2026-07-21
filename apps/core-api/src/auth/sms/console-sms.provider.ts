import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms-provider.interface';

/**
 * Development/POC stand-in for the real SMS gateway. Logs the OTP instead of
 * sending it. Superseded by `NotificationServiceProvider` (T13) as the
 * default binding in auth.module.ts; kept as a dependency-free fallback for
 * local dev/tests that don't have notification-service running.
 */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async sendOtp(
    userId: string,
    phone: string,
    otp: string,
    expiresInSeconds: number,
  ): Promise<void> {
    this.logger.log(
      `[DEV SMS STUB] OTP for ${phone} (user ${userId}): ${otp} (valid ${expiresInSeconds}s)`,
    );
    return Promise.resolve();
  }
}
