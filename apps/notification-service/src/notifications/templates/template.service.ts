import { Injectable } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationEvent,
  PreferredLanguage,
} from '@shgap/database';
import {
  EmailMessage,
  SmsMessage,
  VoiceMessage,
  WhatsappMessage,
} from '../providers/provider.interface';
import {
  EMAIL_TEMPLATES,
  SMS_TEMPLATES,
  TemplateContext,
  VOICE_TEMPLATES,
  WHATSAPP_TEMPLATES,
} from './templates';

export type RenderedMessage =
  SmsMessage | WhatsappMessage | VoiceMessage | EmailMessage;

/** No template exists for a given (event, channel) pair — distinct from a
 * provider failure, since this is a configuration gap the caller can't retry
 * its way out of. */
export class TemplateNotFoundError extends Error {
  constructor(event: NotificationEvent, channel: NotificationChannel) {
    super(`No ${channel} template registered for event ${event}`);
  }
}

@Injectable()
export class TemplateService {
  /** The `templateKey` persisted on the `Notification` row for this
   * (event, channel) — used before a job is even enqueued, so a missing
   * template is caught immediately rather than after a retry-eligible job
   * has already been created. */
  templateKeyFor(
    event: NotificationEvent,
    channel: NotificationChannel,
  ): string {
    const entry = this.registryFor(channel)[event];
    if (!entry) throw new TemplateNotFoundError(event, channel);
    return entry.templateKey;
  }

  render(
    event: NotificationEvent,
    channel: NotificationChannel,
    context: TemplateContext,
    language: PreferredLanguage,
  ): RenderedMessage {
    const entry = this.registryFor(channel)[event];
    if (!entry) throw new TemplateNotFoundError(event, channel);
    return entry.render(context, language);
  }

  private registryFor(
    channel: NotificationChannel,
  ): Record<
    string,
    {
      templateKey: string;
      render: (
        ctx: TemplateContext,
        lang: PreferredLanguage,
      ) => RenderedMessage;
    }
  > {
    switch (channel) {
      case NotificationChannel.SMS:
        return SMS_TEMPLATES;
      case NotificationChannel.WHATSAPP:
        return WHATSAPP_TEMPLATES;
      case NotificationChannel.VOICE:
        return VOICE_TEMPLATES;
      case NotificationChannel.EMAIL:
        return EMAIL_TEMPLATES;
    }
  }
}
