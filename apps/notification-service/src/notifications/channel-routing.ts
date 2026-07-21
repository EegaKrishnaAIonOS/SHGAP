import {
  ConsentPurpose,
  NotificationChannel,
  NotificationEvent,
} from '@shgap/database';

/**
 * Default channel fan-out per event, when a dispatch call doesn't specify
 * `channels` explicitly (see dto/dispatch-notification.dto.ts). Each channel
 * becomes its own `Notification` row and queue job — see ADR-0022 for the
 * reasoning:
 *
 * - OTP: SMS only — fastest single channel, matches the DLT OTP-template
 *   convention; a login code arriving over three channels is just noise.
 * - BUYER_ENQUIRY: SMS + WhatsApp in parallel — a business lead is time
 *   sensitive and not every member has WhatsApp, so both fire rather than
 *   picking one.
 * - DEMAND_INCREASE / PRICE_CHANGE: WhatsApp + Email — informational,
 *   non-urgent, no need for an interruptive voice call.
 * - TENDER_OPPORTUNITY: WhatsApp + Email + Voice — a paid opportunity is
 *   worth a voice nudge too, since missing it has a real cost.
 */
export const DEFAULT_CHANNELS_BY_EVENT: Record<
  NotificationEvent,
  NotificationChannel[]
> = {
  [NotificationEvent.OTP]: [NotificationChannel.SMS],
  [NotificationEvent.BUYER_ENQUIRY]: [
    NotificationChannel.SMS,
    NotificationChannel.WHATSAPP,
  ],
  [NotificationEvent.DEMAND_INCREASE]: [
    NotificationChannel.WHATSAPP,
    NotificationChannel.EMAIL,
  ],
  [NotificationEvent.PRICE_CHANGE]: [
    NotificationChannel.WHATSAPP,
    NotificationChannel.EMAIL,
  ],
  [NotificationEvent.TENDER_OPPORTUNITY]: [
    NotificationChannel.WHATSAPP,
    NotificationChannel.EMAIL,
    NotificationChannel.VOICE,
  ],
};

/**
 * Transactional events (OTP, a direct reply to something the member is
 * actively waiting on) are never consent-gated — they're essential to using
 * the service, not marketing. Everything else here is informational/
 * promotional and requires a granted `MARKETING_NOTIFICATIONS` consent
 * record (DPDP Act 2023) before it's sent — see notifications.service.ts.
 */
export const TRANSACTIONAL_EVENTS: ReadonlySet<NotificationEvent> = new Set([
  NotificationEvent.OTP,
  NotificationEvent.BUYER_ENQUIRY,
]);

export const MARKETING_CONSENT_PURPOSE = ConsentPurpose.MARKETING_NOTIFICATIONS;
