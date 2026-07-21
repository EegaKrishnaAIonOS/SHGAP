import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationStatus, User } from '@shgap/database';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATIONS_QUEUE } from './notifications.service';
import {
  EmailMessage,
  EmailProvider,
  ProviderSendResult,
  SmsMessage,
  SmsProvider,
  VoiceMessage,
  VoiceProvider,
  WhatsappMessage,
  WhatsappProvider,
} from './providers/provider.interface';
import {
  EMAIL_PROVIDER,
  SMS_PROVIDER,
  VOICE_PROVIDER,
  WHATSAPP_PROVIDER,
} from './providers/provider.tokens';
import { RenderedMessage, TemplateService } from './templates/template.service';

export interface SendJobData {
  notificationId: string;
}

/**
 * BullMQ worker for the `notifications` queue — one job per `Notification`
 * row (see notifications.service.ts). Re-reads the row fresh from Postgres
 * rather than trusting the job payload for anything beyond the id, so the
 * database (not the queue) stays the single source of truth for what's
 * actually being sent (ADR-0022).
 *
 * Retries are BullMQ's own (configured per-job in notifications.service.ts,
 * `attempts` + exponential `backoff`) — this processor only needs to throw
 * on failure and let BullMQ decide whether to try again; `onFailed` below
 * only fires once BullMQ has given up for good.
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templateService: TemplateService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    @Inject(WHATSAPP_PROVIDER)
    private readonly whatsappProvider: WhatsappProvider,
    @Inject(VOICE_PROVIDER) private readonly voiceProvider: VoiceProvider,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {
    super();
  }

  async process(job: Job<SendJobData>): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: job.data.notificationId },
      include: { user: true },
    });
    if (!notification) {
      this.logger.warn(
        `Notification ${job.data.notificationId} no longer exists — skipping`,
      );
      return;
    }

    const context = (notification.payload ?? {}) as Record<string, string>;
    const rendered = this.templateService.render(
      notification.event,
      notification.channel,
      context,
      notification.user.preferredLanguage,
    );

    try {
      const result = await this.sendVia(
        notification.channel,
        notification.user,
        rendered,
      );
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          providerMessageId: result.providerMessageId,
          failureReason: null,
        },
      });
    } catch (err) {
      // Records the most recent attempt's error for visibility even if a
      // later retry goes on to succeed; `onFailed` below overwrites this
      // with the terminal FAILED status once BullMQ actually gives up.
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { failureReason: (err as Error).message },
      });
      throw err;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<SendJobData> | undefined,
    error: Error,
  ): Promise<void> {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < attempts) return; // more retries still scheduled

    await this.prisma.notification
      .update({
        where: { id: job.data.notificationId },
        data: {
          status: NotificationStatus.FAILED,
          failureReason: error.message,
        },
      })
      .catch((updateErr: Error) => {
        this.logger.error(
          `Failed to record terminal failure for notification ${job.data.notificationId}: ${updateErr.message}`,
        );
      });
  }

  private async sendVia(
    channel: NotificationChannel,
    user: User,
    message: RenderedMessage,
  ): Promise<ProviderSendResult> {
    switch (channel) {
      case NotificationChannel.SMS:
        return this.smsProvider.send(user.phone, message as SmsMessage);
      case NotificationChannel.WHATSAPP:
        return this.whatsappProvider.send(
          user.phone,
          message as WhatsappMessage,
        );
      case NotificationChannel.VOICE:
        return this.voiceProvider.send(user.phone, message as VoiceMessage);
      case NotificationChannel.EMAIL:
        if (!user.email) {
          throw new Error('User has no email address on file');
        }
        return this.emailProvider.send(user.email, message as EmailMessage);
    }
  }
}
