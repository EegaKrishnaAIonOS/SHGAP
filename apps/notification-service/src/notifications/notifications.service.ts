import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@shgap/database';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_CHANNELS_BY_EVENT,
  MARKETING_CONSENT_PURPOSE,
  TRANSACTIONAL_EVENTS,
} from './channel-routing';
import { DispatchNotificationDto } from './dto/dispatch-notification.dto';
import {
  TemplateNotFoundError,
  TemplateService,
} from './templates/template.service';

export interface DispatchResultItem {
  notificationId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
}

export const NOTIFICATIONS_QUEUE = 'notifications';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templateService: TemplateService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
  ) {}

  async dispatch(dto: DispatchNotificationDto): Promise<DispatchResultItem[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException(`No user found with id ${dto.userId}`);
    }

    const channels = dto.channels ?? DEFAULT_CHANNELS_BY_EVENT[dto.event];
    if (!channels || channels.length === 0) {
      throw new BadRequestException(
        `No channels configured for event ${dto.event}`,
      );
    }

    const isTransactional = TRANSACTIONAL_EVENTS.has(dto.event);
    const consentGranted = isTransactional
      ? true
      : await this.hasMarketingConsent(dto.userId);

    const results: DispatchResultItem[] = [];
    for (const channel of channels) {
      let templateKey: string;
      try {
        templateKey = this.templateService.templateKeyFor(dto.event, channel);
      } catch (err) {
        if (err instanceof TemplateNotFoundError) {
          this.logger.warn(err.message);
          continue;
        }
        throw err;
      }

      if (!consentGranted) {
        // Still logged for audit (DPDP requires a record of what wasn't
        // sent and why, not just what was) — reuses FAILED rather than
        // adding a new enum value, since "blocked by policy" is a real
        // terminal outcome, not a delivery attempt that's still pending.
        const blocked = await this.prisma.notification.create({
          data: {
            userId: dto.userId,
            channel,
            event: dto.event,
            templateKey,
            payload: dto.context,
            status: NotificationStatus.FAILED,
            failureReason: 'consent_not_granted',
          },
        });
        results.push({
          notificationId: blocked.id,
          channel,
          status: blocked.status,
        });
        continue;
      }

      const notification = await this.prisma.notification.create({
        data: {
          userId: dto.userId,
          channel,
          event: dto.event,
          templateKey,
          payload: dto.context,
          status: NotificationStatus.QUEUED,
        },
      });

      await this.queue.add(
        'send',
        { notificationId: notification.id },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      );

      results.push({
        notificationId: notification.id,
        channel,
        status: notification.status,
      });
    }

    return results;
  }

  /** Most recent consent record for this (user, purpose) — an append-only
   * log, so "current" status is whatever the latest row says (ADR-0022). No
   * record at all means no consent was ever given, which is treated as not
   * granted (DPDP's default-deny posture for marketing), not granted-by-default. */
  private async hasMarketingConsent(userId: string): Promise<boolean> {
    const latest = await this.prisma.consent.findFirst({
      where: { userId, purpose: MARKETING_CONSENT_PURPOSE },
      orderBy: { grantedAt: 'desc' },
    });
    return Boolean(latest?.granted && !latest.withdrawnAt);
  }
}
