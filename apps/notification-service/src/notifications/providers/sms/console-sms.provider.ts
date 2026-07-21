import { Injectable, Logger } from '@nestjs/common';
import {
  ProviderSendResult,
  SmsMessage,
  SmsProvider,
} from '../provider.interface';

/**
 * Development/POC stand-in for MSG91 — logs the message instead of sending
 * it. Bound in place of `Msg91Provider` whenever `MSG91_AUTH_KEY` isn't
 * configured (see notifications.module.ts), mirroring core-api's
 * `ConsoleSmsProvider` (T05) so the service runs end-to-end without a real
 * DLT-registered SMS account.
 */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async send(
    toPhone: string,
    message: SmsMessage,
  ): Promise<ProviderSendResult> {
    this.logger.log(`[DEV SMS STUB] to ${toPhone}: ${message.renderedText}`);
    return { providerMessageId: `console-sms-${Date.now()}` };
  }
}
