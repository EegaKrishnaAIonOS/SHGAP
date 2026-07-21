import { Injectable, Logger } from '@nestjs/common';
import {
  ProviderSendResult,
  WhatsappMessage,
  WhatsappProvider,
} from '../provider.interface';

/** Development/POC stand-in for the WhatsApp Business Cloud API — see
 * `console-sms.provider.ts` for the pattern this mirrors. */
@Injectable()
export class ConsoleWhatsappProvider implements WhatsappProvider {
  private readonly logger = new Logger(ConsoleWhatsappProvider.name);

  async send(
    toPhone: string,
    message: WhatsappMessage,
  ): Promise<ProviderSendResult> {
    this.logger.log(
      `[DEV WHATSAPP STUB] to ${toPhone}: template="${message.templateName}" params=${JSON.stringify(message.params)}`,
    );
    return { providerMessageId: `console-whatsapp-${Date.now()}` };
  }
}
