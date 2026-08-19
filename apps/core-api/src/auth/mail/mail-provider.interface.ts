export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');

export interface MailProvider {
  /** `userId` is the User row's id, mirroring SmsProvider.sendOtp's shape
   * (see sms/sms-provider.interface.ts) for the same reason: a real FK to
   * reference if/when this is wired into the Notification audit trail.
   * `resetUrl` already has the plaintext token embedded as a query param —
   * only its SHA-256 hash is ever persisted (see AuthService.forgotPassword). */
  sendPasswordReset(
    userId: string,
    email: string,
    resetUrl: string,
    expiresInSeconds: number,
  ): Promise<void>;

  /** Sent once at registration and again on resend — `verifyUrl` has the
   * plaintext token embedded as a query param, only its SHA-256 hash is
   * ever persisted (see AuthService.sendEmailVerification). */
  sendVerificationEmail(
    userId: string,
    email: string,
    verifyUrl: string,
    expiresInSeconds: number,
  ): Promise<void>;
}
