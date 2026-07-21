// class-transformer's enableImplicitConversion (used below) relies on
// Reflect.getMetadata, which only exists once this polyfill has run — see
// core-api's identical env.validation.ts for the same note.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
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

  // Every provider credential below is optional: when unset, the
  // corresponding channel falls back to a console/dev-stub provider (see
  // notifications/providers/*.provider.ts and ADR-0022) so the service runs
  // and is fully testable without any real MSG91/WhatsApp/Exotel/SES account.

  @IsOptional()
  @IsString()
  MSG91_AUTH_KEY?: string;

  @IsOptional()
  @IsString()
  MSG91_SENDER_ID?: string;

  @IsOptional()
  @IsString()
  WHATSAPP_ACCESS_TOKEN?: string;

  @IsOptional()
  @IsString()
  WHATSAPP_PHONE_NUMBER_ID?: string;

  @IsOptional()
  @IsString()
  EXOTEL_ACCOUNT_SID?: string;

  @IsOptional()
  @IsString()
  EXOTEL_API_KEY?: string;

  @IsOptional()
  @IsString()
  EXOTEL_API_TOKEN?: string;

  @IsOptional()
  @IsString()
  EXOTEL_CALLER_ID?: string;

  @IsOptional()
  @IsString()
  EXOTEL_VOICE_APPLET_URL?: string;

  @IsOptional()
  @IsString()
  AWS_SES_REGION?: string;

  @IsOptional()
  @IsString()
  AWS_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  AWS_SECRET_ACCESS_KEY?: string;

  @IsOptional()
  @IsString()
  SES_FROM_EMAIL?: string;
}

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n${errors.toString()}`);
  }

  return validatedConfig;
}
