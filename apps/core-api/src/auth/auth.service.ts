import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import { UserStatus } from '@shgap/database';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  JwtAccessPayload,
  RefreshTokenPayload,
  RoleAssignment,
} from '../common/interfaces/jwt-payload.interface';
import { SelfRegisterableRole } from './dto/register.dto';
import { MAIL_PROVIDER, MailProvider } from './mail/mail-provider.interface';
import { OtpService } from './otp.service';
import { SMS_PROVIDER, SmsProvider } from './sms/sms-provider.interface';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  mobileNumber: string;
  password: string;
  role: SelfRegisterableRole;
}

export interface RegisterResult {
  status: UserStatus;
  role: SelfRegisterableRole;
}

export interface VerifyEmailResult {
  status: UserStatus;
  role: SelfRegisterableRole;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly otpService: OtpService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    @Inject(MAIL_PROVIDER) private readonly mailProvider: MailProvider,
  ) {}

  async requestOtp(phone: string): Promise<{ message: string }> {
    // Upserted here too (not just on verify) so a real `User.id` already
    // exists for notification-service's dispatch call to reference — its
    // `Notification.userId` is a required FK (T13). A brand-new phone number
    // gets a PENDING_VERIFICATION row; verifyOtp still owns flipping it to
    // ACTIVE once the code is actually confirmed.
    const user = await this.prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone },
    });

    const otp = await this.otpService.generate(phone);
    await this.smsProvider.sendOtp(
      user.id,
      phone,
      otp,
      this.otpService.ttlSeconds,
    );
    return { message: 'OTP sent' };
  }

  async verifyOtp(phone: string, otp: string): Promise<TokenPair> {
    await this.otpService.verify(phone, otp);

    const user = await this.prisma.user.upsert({
      where: { phone },
      update: { status: 'ACTIVE', lastLoginAt: new Date() },
      create: { phone, status: 'ACTIVE', lastLoginAt: new Date() },
    });

    const roleAssignments = await this.loadRoleAssignments(user.id);
    return this.issueTokenPair(user.id, phone, roleAssignments);
  }

  /** Self-registration for the SHG/DISTRIBUTOR/CONSUMER personas (T25) — a
   * separate path from the phone-OTP flow above, which remains the only way
   * officials/admins are provisioned. Never issues tokens: even a CONSUMER
   * (ACTIVE immediately) must still log in via loginWithPassword afterwards. */
  async registerWithPassword(input: RegisterInput): Promise<RegisterResult> {
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingByEmail) {
      throw new ConflictException('An account with this email already exists.');
    }
    const existingByPhone = await this.prisma.user.findUnique({
      where: { phone: input.mobileNumber },
    });
    if (existingByPhone) {
      throw new ConflictException(
        'An account with this mobile number already exists.',
      );
    }

    const role = await this.prisma.role.findUnique({
      where: { name: input.role },
    });
    if (!role) {
      throw new InternalServerErrorException(
        `Role ${input.role} is not seeded — run the database seed script`,
      );
    }

    const passwordHash = await argon2.hash(input.password);
    // Every self-registered account starts here regardless of role — email
    // ownership must be confirmed before CONSUMER goes ACTIVE or
    // SHG/DISTRIBUTOR even reaches admin review (see verifyEmail).
    const user = await this.prisma.user.create({
      data: {
        phone: input.mobileNumber,
        email: input.email,
        name: input.fullName,
        passwordHash,
        status: 'PENDING_VERIFICATION',
      },
    });
    await this.prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });

    await this.sendEmailVerification(user.id, input.email);

    return { status: user.status, role: input.role };
  }

  /** Confirms the token from the emailed verification link and moves the
   * account to its real starting status: ACTIVE immediately for CONSUMER,
   * PENDING_APPROVAL (awaiting admin review) for SHG/DISTRIBUTOR. Single-use,
   * like resetPassword's token below. */
  async verifyEmail(token: string): Promise<VerifyEmailResult> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const key = this.emailVerifyTokenKey(tokenHash);
    const userId = await this.redis.get(key);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired verification link.');
    }
    await this.redis.del(key);

    const roleAssignments = await this.loadRoleAssignments(userId);
    // Self-registration (the only path that ever creates a
    // PENDING_VERIFICATION user) assigns exactly one role.
    const role = roleAssignments[0]?.role as SelfRegisterableRole | undefined;
    if (!role) {
      throw new InternalServerErrorException(
        `User ${userId} has no role assignment to verify against`,
      );
    }

    const status: UserStatus =
      role === 'CONSUMER' ? 'ACTIVE' : 'PENDING_APPROVAL';
    await this.prisma.user.update({ where: { id: userId }, data: { status } });

    return { status, role };
  }

  /** Always resolves, even for an unknown/already-verified email — no
   * account enumeration, mirroring forgotPassword below. */
  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'PENDING_VERIFICATION') {
      return;
    }
    await this.sendEmailVerification(user.id, email);
  }

  private async sendEmailVerification(
    userId: string,
    email: string,
  ): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const ttlSeconds = this.config.getOrThrow<number>(
      'EMAIL_VERIFICATION_TTL_SECONDS',
    );
    await this.redis.set(
      this.emailVerifyTokenKey(tokenHash),
      userId,
      'EX',
      ttlSeconds,
    );

    const webAppUrl = this.config.getOrThrow<string>('WEB_APP_URL');
    const verifyUrl = `${webAppUrl}/verify-email?token=${token}`;
    await this.mailProvider.sendVerificationEmail(
      userId,
      email,
      verifyUrl,
      ttlSeconds,
    );
  }

  /** Email+password login (T25) — the only auth path for DISTRIBUTOR/CONSUMER
   * personas; SHG members may use either this or phone-OTP. Blocks
   * non-ACTIVE accounts from ever obtaining a token, per-status, rather than
   * relying solely on a frontend check. */
  async loginWithPassword(
    email: string,
    password: string,
    rememberMe?: boolean,
  ): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      !user.passwordHash ||
      !(await argon2.verify(user.passwordHash, password))
    ) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.status === 'PENDING_VERIFICATION') {
      throw new ForbiddenException(
        'Please verify your email before logging in.',
      );
    }
    if (user.status === 'PENDING_APPROVAL') {
      throw new ForbiddenException('Account Pending Approval');
    }
    if (user.status === 'REJECTED') {
      throw new ForbiddenException('Account Rejected');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const roleAssignments = await this.loadRoleAssignments(user.id);
    // "Remember me" unchecked -> a shorter session than the default (and
    // OTP-flow) refresh-token lifetime; checked -> today's default TTL.
    const refreshTtlOverride = rememberMe
      ? undefined
      : this.config.getOrThrow<number>('LOGIN_SESSION_REFRESH_TTL_SECONDS');
    return this.issueTokenPair(
      user.id,
      user.phone,
      roleAssignments,
      refreshTtlOverride,
    );
  }

  /** Always resolves, even for an unknown email — no account enumeration.
   * The controller returns the same generic response either way. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const ttlSeconds = this.config.getOrThrow<number>(
      'PASSWORD_RESET_TTL_SECONDS',
    );
    await this.redis.set(
      this.resetTokenKey(tokenHash),
      user.id,
      'EX',
      ttlSeconds,
    );

    const webAppUrl = this.config.getOrThrow<string>('WEB_APP_URL');
    const resetUrl = `${webAppUrl}/reset-password?token=${token}`;
    await this.mailProvider.sendPasswordReset(
      user.id,
      email,
      resetUrl,
      ttlSeconds,
    );
  }

  /** Single-use: the presented token's hash is deleted from Redis as soon as
   * it resolves to a user, whether or not the subsequent update succeeds. */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const key = this.resetTokenKey(tokenHash);
    const userId = await this.redis.get(key);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired reset link.');
    }
    await this.redis.del(key);

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const storedKey = this.refreshTokenKey(payload.sub, payload.jti);
    const exists = await this.redis.get(storedKey);
    if (!exists) {
      throw new UnauthorizedException(
        'Refresh token has been revoked or already used',
      );
    }
    // Rotation: the presented refresh token is single-use.
    await this.redis.del(storedKey);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User is no longer active');
    }

    const roleAssignments = await this.loadRoleAssignments(user.id);
    return this.issueTokenPair(user.id, user.phone, roleAssignments);
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );
      await this.redis.del(this.refreshTokenKey(payload.sub, payload.jti));
    } catch {
      // Already invalid/expired — logout is idempotent from the caller's perspective.
    }
  }

  private async loadRoleAssignments(userId: string): Promise<RoleAssignment[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    return userRoles.map((ur) => ({
      role: ur.role.name,
      districtId: ur.districtId ?? undefined,
      ulbId: ur.ulbId ?? undefined,
    }));
  }

  private async issueTokenPair(
    userId: string,
    phone: string,
    roleAssignments: RoleAssignment[],
    refreshTtlSecondsOverride?: number,
  ): Promise<TokenPair> {
    const accessPayload: JwtAccessPayload = {
      sub: userId,
      phone,
      roleAssignments,
    };
    const accessExpiresIn = this.config.getOrThrow<string>(
      'JWT_ACCESS_EXPIRES_IN',
    );
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessExpiresIn,
    });

    const jti = crypto.randomUUID();
    const refreshExpiresIn = this.config.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    // Callers (loginWithPassword, when "remember me" is unchecked) may pass
    // a shorter TTL than the default; the phone-OTP flow never does, so its
    // refresh-token lifetime is unchanged from before this override existed.
    const refreshTtlSeconds =
      refreshTtlSecondsOverride ?? parseDurationToSeconds(refreshExpiresIn);
    const refreshPayload: RefreshTokenPayload = { sub: userId, jti };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshTtlSeconds,
    });

    await this.redis.set(
      this.refreshTokenKey(userId, jti),
      '1',
      'EX',
      refreshTtlSeconds,
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresInSeconds: parseDurationToSeconds(accessExpiresIn),
    };
  }

  private refreshTokenKey(userId: string, jti: string): string {
    return `refresh:${userId}:${jti}`;
  }

  private resetTokenKey(tokenHash: string): string {
    return `pwreset:${tokenHash}`;
  }

  private emailVerifyTokenKey(tokenHash: string): string {
    return `emailverify:${tokenHash}`;
  }
}

/** Parses a JWT-style duration string ("15m", "7d", "3600s") into whole seconds. */
export function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  const value = Number(match[1]);
  const unitSeconds = { s: 1, m: 60, h: 3600, d: 86400 }[
    match[2] as 's' | 'm' | 'h' | 'd'
  ];
  return value * unitSeconds;
}
