import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KMS_KEY_PROVIDER, KmsKeyProvider } from './kms-key-provider.interface';

/**
 * Real column-level encryption at rest (T22/ADR-0031) via pgcrypto's
 * pgp_sym_encrypt/pgp_sym_decrypt — applied today to `Shg.bankAccountNumber`
 * / `Shg.bankIfsc`, the platform's most sensitive existing PII fields.
 * Ciphertext is stored as base64 text (not a `bytea` column) so the Prisma
 * column type didn't need to change — `Shg.bankAccountNumber` stays
 * `String?`, it just now holds an encrypted value instead of plaintext for
 * anything written after this shipped.
 *
 * Pre-T22 seed data is real, unencrypted plaintext (there was no encrypt
 * path before now, and no migration-time key to safely bulk-re-encrypt it
 * with) — `decrypt()` falls back to returning the stored value unchanged
 * when it doesn't parse as this service's own ciphertext, rather than
 * throwing on every legacy row. A real production rollout would run a
 * one-time backfill job through `encrypt()` once a real KMS key exists.
 */
@Injectable()
export class PiiEncryptionService {
  private readonly logger = new Logger(PiiEncryptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(KMS_KEY_PROVIDER) private readonly kms: KmsKeyProvider,
  ) {}

  async encrypt(plaintext: string): Promise<string> {
    const key = await this.kms.getPiiEncryptionKey();
    const rows = await this.prisma.$queryRaw<{ encrypted: string }[]>`
      SELECT encode(pgp_sym_encrypt(${plaintext}, ${key}), 'base64') AS encrypted
    `;
    return rows[0].encrypted;
  }

  async decrypt(ciphertext: string | null | undefined): Promise<string | null> {
    if (ciphertext == null) return null;
    const key = await this.kms.getPiiEncryptionKey();
    try {
      const rows = await this.prisma.$queryRaw<{ decrypted: string }[]>`
        SELECT pgp_sym_decrypt(decode(${ciphertext}, 'base64'), ${key}) AS decrypted
      `;
      return rows[0].decrypted;
    } catch {
      this.logger.debug(
        'Value did not decrypt as pgcrypto ciphertext — treating as legacy plaintext',
      );
      return ciphertext;
    }
  }
}
