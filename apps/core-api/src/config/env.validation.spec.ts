import { validate } from './env.validation';

const BASE_ENV: Record<string, unknown> = {
  NODE_ENV: 'development',
  PORT: '3000',
  DATABASE_URL: 'postgresql://x',
  REDIS_URL: 'redis://x',
  JWT_ACCESS_SECRET: 'x',
  JWT_REFRESH_SECRET: 'x',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  OTP_LENGTH: '6',
  OTP_TTL_SECONDS: '300',
  OTP_MAX_REQUESTS_PER_WINDOW: '5',
  OTP_RATE_LIMIT_WINDOW_SECONDS: '3600',
  MINIO_ENDPOINT: 'localhost',
  MINIO_PORT: '9000',
  MINIO_USE_SSL: 'false',
  MINIO_ACCESS_KEY: 'x',
  MINIO_SECRET_KEY: 'x',
  MINIO_BUCKET: 'x',
  MINIO_PUBLIC_URL: 'http://x',
  CLAMAV_HOST: 'x',
  CLAMAV_PORT: '3310',
  ML_SERVICES_URL: 'http://x',
};

describe('validate (env)', () => {
  it('parses numeric env vars into real numbers', () => {
    const result = validate(BASE_ENV);
    expect(result.PORT).toBe(3000);
    expect(typeof result.PORT).toBe('number');
  });

  // Regression test: enableImplicitConversion casts remaining strings via
  // Boolean(value), and Boolean("false") is `true` (any non-empty string is
  // truthy) — this exact bug made the app try TLS against MinIO's plain HTTP
  // port. MINIO_USE_SSL must be preprocessed into a real boolean beforehand.
  it('parses the string "false" as boolean false, not true', () => {
    const result = validate({ ...BASE_ENV, MINIO_USE_SSL: 'false' });
    expect(result.MINIO_USE_SSL).toBe(false);
  });

  it('parses the string "true" as boolean true', () => {
    const result = validate({ ...BASE_ENV, MINIO_USE_SSL: 'true' });
    expect(result.MINIO_USE_SSL).toBe(true);
  });

  it('throws when a required variable is missing', () => {
    const withoutDbUrl = { ...BASE_ENV };
    delete withoutDbUrl.DATABASE_URL;
    expect(() => validate(withoutDbUrl)).toThrow(
      'Invalid environment configuration',
    );
  });
});
