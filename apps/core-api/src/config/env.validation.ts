// class-transformer's enableImplicitConversion (used below) relies on
// Reflect.getMetadata, which only exists once this polyfill has run. The full
// Nest app happens to pull it in transitively via other Nest packages, but
// this module shouldn't depend on that — it needs it directly.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  REDIS_URL: string;

  @IsString()
  JWT_ACCESS_SECRET: string;

  @IsString()
  JWT_REFRESH_SECRET: string;

  @IsString()
  JWT_ACCESS_EXPIRES_IN: string;

  @IsString()
  JWT_REFRESH_EXPIRES_IN: string;

  @IsInt()
  @Min(4)
  @Max(8)
  OTP_LENGTH: number;

  @IsInt()
  @Min(30)
  OTP_TTL_SECONDS: number;

  @IsInt()
  @Min(1)
  OTP_MAX_REQUESTS_PER_WINDOW: number;

  @IsInt()
  @Min(60)
  OTP_RATE_LIMIT_WINDOW_SECONDS: number;

  // Email+password auth (T25) — forgot-password reset tokens, mirroring the
  // OTP_* TTL pattern above but for the Redis-backed reset-token key.
  @IsInt()
  @Min(60)
  PASSWORD_RESET_TTL_SECONDS: number;

  // Email-verification link lifetime (T25) — much longer than a password
  // reset since people don't always check a new account's inbox right away.
  @IsInt()
  @Min(60)
  EMAIL_VERIFICATION_TTL_SECONDS: number;

  // Refresh-token lifetime for a password-login session that did NOT check
  // "remember me" (see AuthService.loginWithPassword) — shorter than
  // JWT_REFRESH_EXPIRES_IN, which remembered sessions and the existing
  // phone-OTP flow both continue to use as-is.
  @IsInt()
  @Min(60)
  LOGIN_SESSION_REFRESH_TTL_SECONDS: number;

  // Base URL of the deployed web app (apps/web) — used only to build the
  // password-reset link sent via MailProvider; never called by core-api.
  @IsString()
  WEB_APP_URL: string;

  @IsString()
  MINIO_ENDPOINT: string;

  @IsInt()
  MINIO_PORT: number;

  @IsBoolean()
  MINIO_USE_SSL: boolean;

  @IsString()
  MINIO_ACCESS_KEY: string;

  @IsString()
  MINIO_SECRET_KEY: string;

  @IsString()
  MINIO_BUCKET: string;

  @IsString()
  MINIO_PUBLIC_URL: string;

  @IsString()
  CLAMAV_HOST: string;

  @IsInt()
  CLAMAV_PORT: number;

  @IsString()
  ML_SERVICES_URL: string;

  @IsString()
  NOTIFICATION_SERVICE_URL: string;

  // No real KMS access exists for this pilot (see ADR-0031, same gap as
  // ADR-0030's ONDC signing key) — optional, not a required secret like
  // JWT_ACCESS_SECRET above, because PiiEncryptionService generates a
  // random dev-only key at boot when this is unset.
  @IsOptional()
  @IsString()
  PII_ENCRYPTION_KEY?: string;
}

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  // Booleans must be converted to real booleans *before* plainToInstance runs —
  // enableImplicitConversion casts remaining strings via Boolean(value), and
  // Boolean("false") is `true` (any non-empty string is truthy). Doing it here
  // avoids that trap instead of fighting it with a @Transform decorator, which
  // runs too late: implicit conversion has already mangled the value by then.
  const withRealBooleans = {
    ...config,
    MINIO_USE_SSL:
      config.MINIO_USE_SSL === true || config.MINIO_USE_SSL === 'true',
  };

  const validatedConfig = plainToInstance(
    EnvironmentVariables,
    withRealBooleans,
    {
      enableImplicitConversion: true,
    },
  );
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n${errors.toString()}`);
  }

  return validatedConfig;
}
