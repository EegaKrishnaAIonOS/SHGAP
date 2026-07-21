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
