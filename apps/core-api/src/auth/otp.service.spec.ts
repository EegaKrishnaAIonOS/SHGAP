import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { OtpService } from './otp.service';

describe('OtpService', () => {
  let redis: {
    incr: jest.Mock;
    expire: jest.Mock;
    set: jest.Mock;
    get: jest.Mock;
    del: jest.Mock;
  };
  let config: ConfigService;
  let service: OtpService;

  const CONFIG: Record<string, number> = {
    OTP_LENGTH: 6,
    OTP_TTL_SECONDS: 300,
    OTP_MAX_REQUESTS_PER_WINDOW: 5,
    OTP_RATE_LIMIT_WINDOW_SECONDS: 3600,
  };

  beforeEach(() => {
    redis = {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
    };
    config = {
      getOrThrow: (key: string) => CONFIG[key],
    } as unknown as ConfigService;
    service = new OtpService(redis as any, config);
  });

  it('generates an OTP of the configured length and stores it with a TTL', async () => {
    const otp = await service.generate('9876543210');
    expect(otp).toMatch(/^\d{6}$/);
    expect(redis.set).toHaveBeenCalledWith(
      'otp:code:9876543210',
      otp,
      'EX',
      300,
    );
  });

  it('sets a TTL on the rate-limit counter only on the first request in a window', async () => {
    redis.incr.mockResolvedValueOnce(1);
    await service.generate('9876543210');
    expect(redis.expire).toHaveBeenCalledWith('otp:rate:9876543210', 3600);

    redis.expire.mockClear();
    redis.incr.mockResolvedValueOnce(2);
    await service.generate('9876543210');
    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('throws once the per-window request limit is exceeded', async () => {
    redis.incr.mockResolvedValueOnce(6);
    await expect(service.generate('9876543210')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('verifies a matching OTP and deletes it (single use)', async () => {
    redis.get.mockResolvedValueOnce('123456');
    await service.verify('9876543210', '123456');
    expect(redis.del).toHaveBeenCalledWith('otp:code:9876543210');
  });

  it('rejects a mismatched OTP', async () => {
    redis.get.mockResolvedValueOnce('123456');
    await expect(service.verify('9876543210', '000000')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when no OTP was ever requested (expired or never generated)', async () => {
    redis.get.mockResolvedValueOnce(null);
    await expect(service.verify('9876543210', '123456')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
