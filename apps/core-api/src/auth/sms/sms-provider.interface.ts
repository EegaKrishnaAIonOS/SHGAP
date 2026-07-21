export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export interface SmsProvider {
  /** `userId` is the User row's id (see AuthService.requestOtp, which
   * upserts it before calling this) — required by notification-service's
   * dispatch API (T13), which logs every notification against a real
   * `Notification.userId` FK. `expiresInSeconds` is OtpService's configured
   * TTL, for providers that mention it in the message (e.g. "valid for 10
   * minutes"). */
  sendOtp(
    userId: string,
    phone: string,
    otp: string,
    expiresInSeconds: number,
  ): Promise<void>;
}
