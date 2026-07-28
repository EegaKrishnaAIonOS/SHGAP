import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationEvent } from '@shgap/database';

/**
 * Generic core-api → notification-service dispatch call, for any event
 * beyond OTP (which already has its own dedicated `SmsProvider` /
 * `NotificationServiceProvider`, `auth/sms/notification-service.provider.ts`
 * — kept separate since OTP dispatch failure must throw, not degrade).
 *
 * This client is deliberately best-effort: `dispatch()` never throws. A
 * tender-opportunity alert (its first caller, T21) is a nice-to-have on
 * top of an already-recorded GeM opportunity — a delivery failure here
 * must not roll back or block the write that triggered it, matching this
 * codebase's "unreachable ml-services = log + return a safe default"
 * convention (CategorizationService) rather than its "unreachable = throw"
 * one (OTP, recommendation matching).
 */
@Injectable()
export class NotificationDispatchClient {
  private readonly logger = new Logger(NotificationDispatchClient.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('NOTIFICATION_SERVICE_URL');
  }

  async dispatch(
    userId: string,
    event: NotificationEvent,
    context: Record<string, string>,
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/notifications/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, event, context }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.warn(
          `notification-service rejected ${event} dispatch for user ${userId}: ${response.status} ${body}`,
        );
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(
        `notification-service unreachable dispatching ${event} for user ${userId}: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
