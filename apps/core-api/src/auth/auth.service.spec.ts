import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService, parseDurationToSeconds } from './auth.service';
import { OtpService } from './otp.service';
import { SmsProvider } from './sms/sms-provider.interface';

describe('parseDurationToSeconds', () => {
  it.each([
    ['30s', 30],
    ['15m', 900],
    ['2h', 7200],
    ['7d', 604800],
  ])('parses %s as %d seconds', (input, expected) => {
    expect(parseDurationToSeconds(input)).toBe(expected);
  });

  it('throws on an invalid format', () => {
    expect(() => parseDurationToSeconds('nonsense')).toThrow();
  });
});

describe('AuthService', () => {
  let prisma: any;
  let redis: any;
  let jwt: JwtService;
  let config: ConfigService;
  let otpService: jest.Mocked<OtpService>;
  let smsProvider: jest.Mocked<SmsProvider>;
  let service: AuthService;

  const CONFIG: Record<string, string> = {
    JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
  };

  const activeUser = {
    id: 'user-1',
    phone: '9876543210',
    status: 'ACTIVE',
  };

  beforeEach(() => {
    prisma = {
      user: {
        upsert: jest.fn().mockResolvedValue(activeUser),
        findUnique: jest.fn().mockResolvedValue(activeUser),
      },
      userRole: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    redis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue('1'),
      del: jest.fn().mockResolvedValue(1),
    };
    jwt = new JwtService({});
    config = {
      getOrThrow: (key: string) => CONFIG[key],
    } as unknown as ConfigService;
    otpService = {
      generate: jest.fn(),
      verify: jest.fn(),
    } as unknown as jest.Mocked<OtpService>;
    smsProvider = { sendOtp: jest.fn().mockResolvedValue(undefined) };

    service = new AuthService(
      prisma,
      redis,
      jwt,
      config,
      otpService,
      smsProvider,
    );
  });

  describe('requestOtp', () => {
    it('generates an OTP and sends it via the SMS provider', async () => {
      otpService.generate.mockResolvedValueOnce('123456');
      const result = await service.requestOtp('9876543210');

      expect(otpService.generate).toHaveBeenCalledWith('9876543210');
      expect(smsProvider.sendOtp).toHaveBeenCalledWith('9876543210', '123456');
      expect(result).toEqual({ message: 'OTP sent' });
    });
  });

  describe('verifyOtp', () => {
    it('verifies the OTP, upserts the user, and issues a token pair', async () => {
      const tokens = await service.verifyOtp('9876543210', '123456');

      expect(otpService.verify).toHaveBeenCalledWith('9876543210', '123456');
      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { phone: '9876543210' } }),
      );
      expect(tokens.tokenType).toBe('Bearer');
      expect(tokens.expiresInSeconds).toBe(900);
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');

      // The refresh token's jti must be stored in Redis for later revocation/rotation checks.
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh:user-1:/),
        '1',
        'EX',
        604800,
      );
    });

    it('propagates the OTP service rejection without issuing tokens', async () => {
      otpService.verify.mockRejectedValueOnce(
        new UnauthorizedException('Invalid or expired OTP'),
      );
      await expect(service.verifyOtp('9876543210', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.user.upsert).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    async function issueRefreshToken() {
      const tokens = await service.verifyOtp('9876543210', '123456');
      return tokens.refreshToken;
    }

    it('rotates the refresh token and issues a new pair when the presented token is valid', async () => {
      const refreshToken = await issueRefreshToken();
      redis.get.mockResolvedValueOnce('1'); // token is still present (not yet used/revoked)

      const rotated = await service.refresh(refreshToken);

      expect(rotated.accessToken).toEqual(expect.any(String));
      expect(rotated.refreshToken).not.toBe(refreshToken);
      expect(redis.del).toHaveBeenCalled(); // old refresh token invalidated
    });

    it('rejects when the refresh token is not found in Redis (already used or revoked)', async () => {
      const refreshToken = await issueRefreshToken();
      redis.get.mockResolvedValueOnce(null);

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a malformed/invalid refresh token', async () => {
      await expect(service.refresh('not-a-real-jwt')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects when the user is no longer active', async () => {
      const refreshToken = await issueRefreshToken();
      redis.get.mockResolvedValueOnce('1');
      prisma.user.findUnique.mockResolvedValueOnce({
        ...activeUser,
        status: 'SUSPENDED',
      });

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('deletes the refresh token record', async () => {
      const tokens = await service.verifyOtp('9876543210', '123456');
      await service.logout(tokens.refreshToken);
      expect(redis.del).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh:user-1:/),
      );
    });

    it('does not throw for an already-invalid refresh token', async () => {
      await expect(service.logout('garbage')).resolves.toBeUndefined();
    });
  });
});
