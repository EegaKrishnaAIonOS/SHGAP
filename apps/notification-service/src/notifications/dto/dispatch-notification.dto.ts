import { NotificationChannel, NotificationEvent } from '@shgap/database';
import { IsArray, IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';

/**
 * A domain event another service is telling notification-service about —
 * e.g. core-api's auth flow calls this with `event: OTP` right after
 * generating an OTP (see ADR-0022). `context` supplies the values each
 * event's templates need (see notifications/templates/templates.ts for
 * exactly which keys each event expects — e.g. OTP needs `otp` and
 * `expiresInMinutes`).
 */
export class DispatchNotificationDto {
  @IsUUID()
  userId: string;

  @IsEnum(NotificationEvent)
  event: NotificationEvent;

  @IsObject()
  context: Record<string, string>;

  /** Overrides `channel-routing.ts`'s default fan-out for this one call —
   * omit to use the event's default channels. */
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];
}
