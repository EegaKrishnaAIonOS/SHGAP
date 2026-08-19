import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService, parseDurationToSeconds } from './auth.service';
import { MailProvider } from './mail/mail-provider.interface';
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
  let mailProvider: jest.Mocked<MailProvider>;
  let service: AuthService;

  const CONFIG: Record<string, string | number> = {
    JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    PASSWORD_RESET_TTL_SECONDS: 1800,
    EMAIL_VERIFICATION_TTL_SECONDS: 86400,
    LOGIN_SESSION_REFRESH_TTL_SECONDS: 86400,
    WEB_APP_URL: 'http://localhost:5173',
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
        create: jest.fn().mockResolvedValue(activeUser),
        update: jest.fn().mockResolvedValue(activeUser),
      },
      userRole: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
      },
      role: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'role-1', name: 'CONSUMER' }),
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
      ttlSeconds: 300,
    } as unknown as jest.Mocked<OtpService>;
    smsProvider = { sendOtp: jest.fn().mockResolvedValue(undefined) };
    mailProvider = {
      sendPasswordReset: jest.fn().mockResolvedValue(undefined),
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      prisma,
      redis,
      jwt,
      config,
      otpService,
      smsProvider,
      mailProvider,
    );
  });

  describe('requestOtp', () => {
    it('upserts the user, generates an OTP, and sends it via the SMS provider', async () => {
      otpService.generate.mockResolvedValueOnce('123456');
      const result = await service.requestOtp('9876543210');

      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { phone: '9876543210' },
        update: {},
        create: { phone: '9876543210' },
      });
      expect(otpService.generate).toHaveBeenCalledWith('9876543210');
      expect(smsProvider.sendOtp).toHaveBeenCalledWith(
        'user-1',
        '9876543210',
        '123456',
        300,
      );
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

  describe('registerWithPassword', () => {
    const input = {
      fullName: 'Lakshmi Devi',
      email: 'lakshmi@example.com',
      mobileNumber: '9876543210',
      password: 'Str0ngPass!',
      role: 'CONSUMER' as const,
    };

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(null); // no existing email/phone
    });

    it('creates every role as PENDING_VERIFICATION and emails a verification link', async () => {
      prisma.user.create.mockResolvedValueOnce({
        id: 'user-2',
        status: 'PENDING_VERIFICATION',
      });

      const result = await service.registerWithPassword(input);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phone: input.mobileNumber,
            email: input.email,
            name: input.fullName,
            status: 'PENDING_VERIFICATION',
          }),
        }),
      );
      expect(prisma.userRole.create).toHaveBeenCalledWith({
        data: { userId: 'user-2', roleId: 'role-1' },
      });
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^emailverify:/),
        'user-2',
        'EX',
        86400,
      );
      expect(mailProvider.sendVerificationEmail).toHaveBeenCalledWith(
        'user-2',
        input.email,
        expect.stringContaining('http://localhost:5173/verify-email?token='),
        86400,
      );
      expect(result).toEqual({
        status: 'PENDING_VERIFICATION',
        role: 'CONSUMER',
      });
    });

    it('creates an SHG/DISTRIBUTOR as PENDING_VERIFICATION too (approval comes after email verification)', async () => {
      prisma.user.create.mockResolvedValueOnce({
        id: 'user-3',
        status: 'PENDING_VERIFICATION',
      });

      const result = await service.registerWithPassword({
        ...input,
        role: 'DISTRIBUTOR',
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PENDING_VERIFICATION' }),
        }),
      );
      expect(result.status).toBe('PENDING_VERIFICATION');
    });

    it('rejects a duplicate email without creating a user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing' }); // email lookup

      await expect(service.registerWithPassword(input)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate mobile number without creating a user', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // email lookup: free
        .mockResolvedValueOnce({ id: 'existing' }); // phone lookup: taken

      await expect(service.registerWithPassword(input)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('loginWithPassword', () => {
    it('issues tokens for an ACTIVE user with a correct password', async () => {
      const passwordHash = await argon2.hash('Str0ngPass!');
      prisma.user.findUnique.mockResolvedValueOnce({
        ...activeUser,
        email: 'lakshmi@example.com',
        passwordHash,
      });

      const tokens = await service.loginWithPassword(
        'lakshmi@example.com',
        'Str0ngPass!',
        true,
      );

      expect(tokens.tokenType).toBe('Bearer');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } }),
      );
    });

    it('uses the shorter session TTL when rememberMe is false', async () => {
      const passwordHash = await argon2.hash('Str0ngPass!');
      prisma.user.findUnique.mockResolvedValueOnce({
        ...activeUser,
        email: 'lakshmi@example.com',
        passwordHash,
      });

      await service.loginWithPassword(
        'lakshmi@example.com',
        'Str0ngPass!',
        false,
      );

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh:user-1:/),
        '1',
        'EX',
        86400,
      );
    });

    it('rejects an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.loginWithPassword('nobody@example.com', 'whatever'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an incorrect password', async () => {
      const passwordHash = await argon2.hash('Str0ngPass!');
      prisma.user.findUnique.mockResolvedValueOnce({
        ...activeUser,
        passwordHash,
      });
      await expect(
        service.loginWithPassword('lakshmi@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a PENDING_VERIFICATION account without issuing tokens', async () => {
      const passwordHash = await argon2.hash('Str0ngPass!');
      prisma.user.findUnique.mockResolvedValueOnce({
        ...activeUser,
        status: 'PENDING_VERIFICATION',
        passwordHash,
      });
      await expect(
        service.loginWithPassword('lakshmi@example.com', 'Str0ngPass!'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a PENDING_APPROVAL account without issuing tokens', async () => {
      const passwordHash = await argon2.hash('Str0ngPass!');
      prisma.user.findUnique.mockResolvedValueOnce({
        ...activeUser,
        status: 'PENDING_APPROVAL',
        passwordHash,
      });
      await expect(
        service.loginWithPassword('lakshmi@example.com', 'Str0ngPass!'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a REJECTED account without issuing tokens', async () => {
      const passwordHash = await argon2.hash('Str0ngPass!');
      prisma.user.findUnique.mockResolvedValueOnce({
        ...activeUser,
        status: 'REJECTED',
        passwordHash,
      });
      await expect(
        service.loginWithPassword('lakshmi@example.com', 'Str0ngPass!'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('forgotPassword', () => {
    it('stores a hashed reset token and emails the reset link when the user exists', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...activeUser,
        email: 'lakshmi@example.com',
      });

      await service.forgotPassword('lakshmi@example.com');

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^pwreset:/),
        'user-1',
        'EX',
        1800,
      );
      expect(mailProvider.sendPasswordReset).toHaveBeenCalledWith(
        'user-1',
        'lakshmi@example.com',
        expect.stringContaining('http://localhost:5173/reset-password?token='),
        1800,
      );
    });

    it('resolves silently for an unknown email (no account enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.forgotPassword('nobody@example.com'),
      ).resolves.toBeUndefined();
      expect(mailProvider.sendPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('updates the password hash and deletes the reset token', async () => {
      redis.get.mockResolvedValueOnce('user-1');

      await service.resetPassword('a-valid-token', 'N3wStr0ngPass!');

      expect(redis.del).toHaveBeenCalledWith(
        expect.stringMatching(/^pwreset:/),
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } }),
      );
    });

    it('rejects an invalid or expired token', async () => {
      redis.get.mockResolvedValueOnce(null);
      await expect(
        service.resetPassword('bad-token', 'N3wStr0ngPass!'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyEmail', () => {
    it('moves a CONSUMER to ACTIVE and deletes the verification token', async () => {
      redis.get.mockResolvedValueOnce('user-2');
      prisma.userRole.findMany.mockResolvedValueOnce([
        { districtId: null, ulbId: null, role: { name: 'CONSUMER' } },
      ]);

      const result = await service.verifyEmail('a-valid-token');

      expect(redis.del).toHaveBeenCalledWith(
        expect.stringMatching(/^emailverify:/),
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: { status: 'ACTIVE' },
      });
      expect(result).toEqual({ status: 'ACTIVE', role: 'CONSUMER' });
    });

    it('moves an SHG/DISTRIBUTOR to PENDING_APPROVAL, not ACTIVE', async () => {
      redis.get.mockResolvedValueOnce('user-3');
      prisma.userRole.findMany.mockResolvedValueOnce([
        { districtId: null, ulbId: null, role: { name: 'DISTRIBUTOR' } },
      ]);

      const result = await service.verifyEmail('a-valid-token');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-3' },
        data: { status: 'PENDING_APPROVAL' },
      });
      expect(result).toEqual({
        status: 'PENDING_APPROVAL',
        role: 'DISTRIBUTOR',
      });
    });

    it('rejects an invalid or expired token', async () => {
      redis.get.mockResolvedValueOnce(null);
      await expect(service.verifyEmail('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('resendVerificationEmail', () => {
    it('sends a fresh verification link for a PENDING_VERIFICATION user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-2',
        status: 'PENDING_VERIFICATION',
      });

      await service.resendVerificationEmail('lakshmi@example.com');

      expect(mailProvider.sendVerificationEmail).toHaveBeenCalledWith(
        'user-2',
        'lakshmi@example.com',
        expect.stringContaining('http://localhost:5173/verify-email?token='),
        86400,
      );
    });

    it('resolves silently for an unknown email (no account enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.resendVerificationEmail('nobody@example.com'),
      ).resolves.toBeUndefined();
      expect(mailProvider.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('resolves silently for an already-verified/active user (no re-send)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        status: 'ACTIVE',
      });
      await expect(
        service.resendVerificationEmail('lakshmi@example.com'),
      ).resolves.toBeUndefined();
      expect(mailProvider.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });
});
