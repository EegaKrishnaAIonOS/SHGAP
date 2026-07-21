import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailMessage,
  EmailProvider,
  ProviderSendResult,
} from '../provider.interface';

/**
 * Real Amazon SES integration via the AWS SDK v3 — the one provider here
 * whose exact wire contract is stable and independent of any specific
 * account (unlike Exotel's applet step), though it was still only run
 * against a real Postgres/Redis pipeline in this task, not a real,
 * domain-verified SES sender identity (see ADR-0022).
 */
@Injectable()
export class SesProvider implements EmailProvider {
  private readonly logger = new Logger(SesProvider.name);
  private readonly client: SESClient;
  private readonly fromEmail: string;

  constructor(config: ConfigService) {
    this.client = new SESClient({
      region: config.getOrThrow<string>('AWS_SES_REGION'),
      credentials: {
        accessKeyId: config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.fromEmail = config.getOrThrow<string>('SES_FROM_EMAIL');
  }

  async send(
    toEmail: string,
    message: EmailMessage,
  ): Promise<ProviderSendResult> {
    const response = await this.client.send(
      new SendEmailCommand({
        Source: this.fromEmail,
        Destination: { ToAddresses: [toEmail] },
        Message: {
          Subject: { Data: message.subject, Charset: 'UTF-8' },
          Body: { Text: { Data: message.bodyText, Charset: 'UTF-8' } },
        },
      }),
    );

    this.logger.log(
      `SES accepted email to ${toEmail} (message_id=${response.MessageId})`,
    );
    return { providerMessageId: response.MessageId };
  }
}
