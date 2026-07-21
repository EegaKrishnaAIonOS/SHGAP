import { Injectable, Logger } from '@nestjs/common';
import {
  EmailMessage,
  EmailProvider,
  ProviderSendResult,
} from '../provider.interface';

/** Development/POC stand-in for Amazon SES — see `console-sms.provider.ts`
 * for the pattern this mirrors. */
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async send(
    toEmail: string,
    message: EmailMessage,
  ): Promise<ProviderSendResult> {
    this.logger.log(
      `[DEV EMAIL STUB] to ${toEmail}: subject="${message.subject}"`,
    );
    return { providerMessageId: `console-email-${Date.now()}` };
  }
}
