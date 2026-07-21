import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider } from './sms-provider.interface';

/**
 * Real OTP delivery path (T13): hands the OTP off to notification-service's
 * dispatch API rather than talking to an SMS gateway directly — core-api
 * doesn't need to know or care whether that account is a real MSG91 account
 * or notification-service's own console/dev-stub fallback (ADR-0022).
 *
 * Unlike CategorizationService's "unreachable = return an empty result"
 * pattern, a dispatch failure here is thrown, not swallowed: an OTP request
 * that silently didn't reach notification-service would leave the member
 * waiting for a code that's never coming, with no way to know that.
 */
@Injectable()
export class NotificationServiceProvider implements SmsProvider {
  private readonly logger = new Logger(NotificationServiceProvider.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('NOTIFICATION_SERVICE_URL');
  }

  async sendOtp(
    userId: string,
    phone: string,
    otp: string,
    expiresInSeconds: number,
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/notifications/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        event: 'OTP',
        context: {
          otp,
          expiresInMinutes: String(Math.round(expiresInSeconds / 60)),
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `notification-service rejected OTP dispatch for ${phone}: ${response.status} ${body}`,
      );
    }

    this.logger.log(
      `OTP dispatch accepted by notification-service for user ${userId}`,
    );
  }
}
