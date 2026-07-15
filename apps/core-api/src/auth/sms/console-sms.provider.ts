import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms-provider.interface';

/**
 * Development/POC stand-in for the real SMS gateway. Logs the OTP instead of
 * sending it. Replace with the MSG91/Gupshup DLT-compliant provider built in
 * T13 (Notification Engine) — this class exists so the auth flow (T05) isn't
 * blocked waiting on notification infrastructure that lands three sprints later.
 */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async sendOtp(phone: string, otp: string): Promise<void> {
    this.logger.log(`[DEV SMS STUB] OTP for ${phone}: ${otp}`);
    return Promise.resolve();
  }
}
