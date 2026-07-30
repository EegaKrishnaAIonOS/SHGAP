export const KMS_KEY_PROVIDER = Symbol('KMS_KEY_PROVIDER');

/** Supplies the symmetric key `PiiEncryptionService` passes to pgcrypto's
 * pgp_sym_encrypt/pgp_sym_decrypt. A real KMS-backed provider (fetching a
 * managed key, e.g. AWS KMS/GCP KMS per ADR-0015) is a one-file swap behind
 * this interface — no live KMS account exists for this pilot (ADR-0031). */
export interface KmsKeyProvider {
  getPiiEncryptionKey(): Promise<string>;
}
