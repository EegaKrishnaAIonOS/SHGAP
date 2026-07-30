import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { KmsKeyProvider } from '../kms-key-provider.interface';

/**
 * No real KMS account exists for this pilot (see ADR-0031 — the same gap
 * ADR-0030 already documented for ONDC's signing key). Reads
 * `PII_ENCRYPTION_KEY` from env when set (so a real deployment can pin a
 * stable key); generates a random one at boot otherwise — which means
 * anything encrypted in a dev session becomes undecryptable the moment the
 * process restarts. That's an acceptable, explicit trade-off for a POC with
 * no real citizen financial data, and it's logged loudly so it's never
 * mistaken for production-grade key management.
 */
@Injectable()
export class EnvKmsKeyProvider implements KmsKeyProvider {
  private readonly logger = new Logger(EnvKmsKeyProvider.name);
  private readonly key: string;

  constructor(config: ConfigService) {
    const configured = config.get<string>('PII_ENCRYPTION_KEY');
    if (configured) {
      this.key = configured;
    } else {
      this.key = randomBytes(32).toString('hex');
      this.logger.warn(
        'PII_ENCRYPTION_KEY not set — generated an ephemeral dev-only encryption key. ' +
          'Anything encrypted this run becomes undecryptable after a restart. Set ' +
          'PII_ENCRYPTION_KEY (or wire a real KMS-backed KmsKeyProvider) before handling real PII.',
      );
    }
  }

  async getPiiEncryptionKey(): Promise<string> {
    return this.key;
  }
}
