import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ProviderSendResult,
  SmsMessage,
  SmsProvider,
} from '../provider.interface';

/**
 * Real MSG91 Flow API (v5) integration — India's DLT regulation requires SMS
 * content to match a pre-registered template, so this always sends via
 * `template_id` + variables, never freeform text (see ADR-0011/ADR-0022).
 *
 * NOTE: built to MSG91's documented Flow API contract but not exercised
 * against a real MSG91 account in this task (no live credentials were
 * available) — see ADR-0022 for what was and wasn't verified live. Throws on
 * any non-success response so BullMQ's retry/backoff (configured in
 * notifications.module.ts) takes over.
 */
@Injectable()
export class Msg91Provider implements SmsProvider {
  private readonly logger = new Logger(Msg91Provider.name);
  private readonly authKey: string;
  private readonly senderId: string;

  constructor(config: ConfigService) {
    this.authKey = config.getOrThrow<string>('MSG91_AUTH_KEY');
    this.senderId = config.getOrThrow<string>('MSG91_SENDER_ID');
  }

  async send(
    toPhone: string,
    message: SmsMessage,
  ): Promise<ProviderSendResult> {
    const response = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { authkey: this.authKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: message.templateId,
        sender: this.senderId,
        short_url: '0',
        recipients: [{ mobiles: `91${toPhone}`, ...message.variables }],
      }),
    });

    const body = (await response.json().catch(() => ({}))) as {
      type?: string;
      message?: string;
      request_id?: string;
    };

    if (!response.ok || body.type === 'error') {
      throw new Error(
        `MSG91 send failed: ${body.message ?? response.statusText}`,
      );
    }

    this.logger.log(
      `MSG91 accepted SMS to ${toPhone} (request_id=${body.request_id ?? 'n/a'})`,
    );
    return { providerMessageId: body.request_id };
  }
}
