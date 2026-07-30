-- T22: Security & DPDP compliance hardening (ADR-0031).

-- Column-level encryption for PII fields (SHG bank account/IFSC) via
-- PiiEncryptionService's pgp_sym_encrypt/pgp_sym_decrypt calls.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Right-to-erasure (DPDP Act 2023): a user account whose PII has been
-- anonymized on request, kept (not hard-deleted) only because other real
-- rows still reference it via a required FK (e.g. Shg.contactUserId).
ALTER TYPE "user_status" ADD VALUE 'ERASED';

-- Tamper-evident audit trail: hash = sha256(previousHash + this row's own
-- canonical fields), computed and verified by AuditService — see that
-- service for why `hash` is safe to add as NOT NULL with no backfill
-- (audit_log has zero rows today; nothing has ever written to it).
ALTER TABLE "audit_log" ADD COLUMN "previous_hash" VARCHAR(64);
ALTER TABLE "audit_log" ADD COLUMN "hash" VARCHAR(64) NOT NULL;
