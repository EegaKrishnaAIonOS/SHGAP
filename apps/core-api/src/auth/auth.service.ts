import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  JwtAccessPayload,
  RefreshTokenPayload,
  RoleAssignment,
} from '../common/interfaces/jwt-payload.interface';
import { OtpService } from './otp.service';
import { SMS_PROVIDER, SmsProvider } from './sms/sms-provider.interface';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
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
  ) {}

  async requestOtp(phone: string): Promise<{ message: string }> {
    const otp = await this.otpService.generate(phone);
    await this.smsProvider.sendOtp(phone, otp);
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
    const refreshPayload: RefreshTokenPayload = { sub: userId, jti };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn,
    });

    const refreshTtlSeconds = parseDurationToSeconds(refreshExpiresIn);
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
