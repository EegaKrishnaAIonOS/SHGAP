import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ProviderSendResult,
  WhatsappMessage,
  WhatsappProvider,
} from '../provider.interface';

/**
 * Real WhatsApp Business (Meta Cloud API) integration — business-initiated
 * messages must use a pre-approved template (Meta's own equivalent of DLT
 * template approval), so this always sends `type: "template"`, never
 * freeform text.
 *
 * NOTE: built to Meta's documented Cloud API contract but not exercised
 * against a real WhatsApp Business account in this task (no live
 * credentials were available) — see ADR-0022.
 */
@Injectable()
export class WhatsappBusinessProvider implements WhatsappProvider {
  private readonly logger = new Logger(WhatsappBusinessProvider.name);
  private readonly accessToken: string;
  private readonly phoneNumberId: string;

  constructor(config: ConfigService) {
    this.accessToken = config.getOrThrow<string>('WHATSAPP_ACCESS_TOKEN');
    this.phoneNumberId = config.getOrThrow<string>('WHATSAPP_PHONE_NUMBER_ID');
  }

  async send(
    toPhone: string,
    message: WhatsappMessage,
  ): Promise<ProviderSendResult> {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: `91${toPhone}`,
          type: 'template',
          template: {
            name: message.templateName,
            language: { code: message.languageCode },
            components: [
              {
                type: 'body',
                parameters: message.params.map((text) => ({
                  type: 'text',
                  text,
                })),
              },
            ],
          },
        }),
      },
    );

    const body = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string };
    };

    if (!response.ok || body.error) {
      throw new Error(
        `WhatsApp send failed: ${body.error?.message ?? response.statusText}`,
      );
    }

    const providerMessageId = body.messages?.[0]?.id;
    this.logger.log(
      `WhatsApp accepted message to ${toPhone} (id=${providerMessageId ?? 'n/a'})`,
    );
    return { providerMessageId };
  }
}
