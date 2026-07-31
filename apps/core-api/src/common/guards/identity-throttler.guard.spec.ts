import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { IdentityThrottlerGuard } from './identity-throttler.guard';

interface ExposedGetTracker {
  getTracker(req: Record<string, unknown>): Promise<string>;
}

describe('IdentityThrottlerGuard', () => {
  function makeGuard(jwt: Partial<JwtService>) {
    const config = {
      getOrThrow: () => 'test-access-secret',
    } as unknown as ConfigService;
    const guard = new IdentityThrottlerGuard(
      [{ ttl: 60_000, limit: 100 }] as unknown as ThrottlerModuleOptions,
      {} as unknown as ThrottlerStorage,
      {} as unknown as Reflector,
      jwt as JwtService,
      config,
    );
    return guard as unknown as ExposedGetTracker;
  }

  it('keys by user id when the bearer token is valid', async () => {
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-123' }),
    };
    const guard = makeGuard(jwt);

    const tracker = await guard.getTracker({
      headers: { authorization: 'Bearer a.valid.token' },
      ip: '10.0.0.5',
    });

    expect(tracker).toBe('user:user-123');
  });

  it('falls back to IP when there is no Authorization header (unauthenticated routes)', async () => {
    const jwt = { verifyAsync: jest.fn() };
    const guard = makeGuard(jwt);

    const tracker = await guard.getTracker({ headers: {}, ip: '10.0.0.5' });

    expect(tracker).toBe('10.0.0.5');
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('falls back to IP when the bearer token is invalid or expired', async () => {
    const jwt = {
      verifyAsync: jest.fn().mockRejectedValue(new Error('jwt expired')),
    };
    const guard = makeGuard(jwt);

    const tracker = await guard.getTracker({
      headers: { authorization: 'Bearer a.stale.token' },
      ip: '10.0.0.5',
    });

    expect(tracker).toBe('10.0.0.5');
  });

  it('never keys by a raw token value, only by the decoded user id or IP', async () => {
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-456' }),
    };
    const guard = makeGuard(jwt);

    const tracker = await guard.getTracker({
      headers: { authorization: 'Bearer a.valid.token' },
      ip: '10.0.0.5',
    });

    expect(tracker).not.toContain('a.valid.token');
  });
});
