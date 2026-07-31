import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

/**
 * T23/ADR-0032: the global anti-abuse throttle (T22) keys by raw source IP
 * by default, which the load test showed collapses onto a single shared
 * bucket for every request behind one IP — true of the load-test harness
 * itself, but just as true of a real MEPMA district/ULB office where many
 * officials sit behind one NAT gateway. For an authenticated request that
 * shared office would exhaust its one shared bucket long before any single
 * official does anything abusive. Keying by the authenticated user's id
 * instead gives each official (and each SHG member) their own bucket.
 *
 * This guard still runs *before* JwtAuthGuard in the global guard chain
 * (deliberately — T22's whole point was capping raw request volume
 * regardless of auth outcome, so an invalid/expired-token flood must stay
 * throttled too), so `req.user` isn't populated yet when getTracker() runs.
 * It decodes the bearer token itself, best-effort: a valid token keys by
 * `sub`; anything else (missing, malformed, expired, or no header at all —
 * exactly the unauthenticated-route case) falls back to the original
 * IP-keyed behaviour, which is exactly what OTP-request abuse prevention
 * needs on the public login endpoints.
 */
@Injectable()
export class IdentityThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const authHeader = req.headers?.authorization as string | undefined;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
          secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        });
        return `user:${payload.sub}`;
      } catch {
        // Invalid/expired token — fall through to IP-keyed throttling below,
        // same as if no token had been presented at all.
      }
    }
    return req.ip;
  }
}
