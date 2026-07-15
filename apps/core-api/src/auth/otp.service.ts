import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class OtpService {
  private readonly otpLength: number;
  private readonly otpTtlSeconds: number;
  private readonly maxRequestsPerWindow: number;
  private readonly rateLimitWindowSeconds: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.otpLength = config.getOrThrow<number>('OTP_LENGTH');
    this.otpTtlSeconds = config.getOrThrow<number>('OTP_TTL_SECONDS');
    this.maxRequestsPerWindow = config.getOrThrow<number>(
      'OTP_MAX_REQUESTS_PER_WINDOW',
    );
    this.rateLimitWindowSeconds = config.getOrThrow<number>(
      'OTP_RATE_LIMIT_WINDOW_SECONDS',
    );
  }

  private otpKey(phone: string): string {
    return `otp:code:${phone}`;
  }

  private rateLimitKey(phone: string): string {
    return `otp:rate:${phone}`;
  }

  /** Generates and stores a new OTP for `phone`, enforcing a per-phone request-rate limit. */
  async generate(phone: string): Promise<string> {
    const rateLimitKey = this.rateLimitKey(phone);
    const requestCount = await this.redis.incr(rateLimitKey);
    if (requestCount === 1) {
      await this.redis.expire(rateLimitKey, this.rateLimitWindowSeconds);
    }
    if (requestCount > this.maxRequestsPerWindow) {
      throw new UnauthorizedException(
        'Too many OTP requests for this number. Please try again later.',
      );
    }

    const otp = crypto
      .randomInt(0, 10 ** this.otpLength)
      .toString()
      .padStart(this.otpLength, '0');
    await this.redis.set(this.otpKey(phone), otp, 'EX', this.otpTtlSeconds);
    return otp;
  }

  /** Verifies `otp` for `phone`; the code is single-use and deleted on a successful match. */
  async verify(phone: string, otp: string): Promise<void> {
    const key = this.otpKey(phone);
    const stored = await this.redis.get(key);

    if (!stored || stored !== otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    await this.redis.del(key);
  }
}
