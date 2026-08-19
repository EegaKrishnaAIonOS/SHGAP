import { Injectable, Logger } from '@nestjs/common';
import { MailProvider } from './mail-provider.interface';

/**
 * Development/POC stand-in for a real email gateway (SES/SMTP/etc). Logs the
 * reset link instead of sending it. Mirrors ConsoleSmsProvider's role in the
 * OTP flow (../sms/console-sms.provider.ts) — swap in a real implementation
 * behind MAIL_PROVIDER in auth.module.ts once one exists.
 */
@Injectable()
export class ConsoleMailProvider implements MailProvider {
  private readonly logger = new Logger(ConsoleMailProvider.name);

  async sendPasswordReset(
    userId: string,
    email: string,
    resetUrl: string,
    expiresInSeconds: number,
  ): Promise<void> {
    this.logger.log(
      `[DEV EMAIL STUB] Password reset for ${email} (user ${userId}): ${resetUrl} (valid ${expiresInSeconds}s)`,
    );
    return Promise.resolve();
  }

  async sendVerificationEmail(
    userId: string,
    email: string,
    verifyUrl: string,
    expiresInSeconds: number,
  ): Promise<void> {
    this.logger.log(
      `[DEV EMAIL STUB] Verify your account for ${email} (user ${userId}): ${verifyUrl} (valid ${expiresInSeconds}s)`,
    );
    return Promise.resolve();
  }
}
