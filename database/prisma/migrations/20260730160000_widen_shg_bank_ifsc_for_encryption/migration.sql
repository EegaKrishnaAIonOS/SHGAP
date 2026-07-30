-- T22 follow-up (ADR-0031): bank_ifsc was VarChar(11) — exactly a real IFSC
-- code's length — which is too narrow for the pgp_sym_encrypt+base64
-- ciphertext PiiEncryptionService now stores there instead of plaintext
-- (measured ~105 characters for an 11-character input). Caught by real
-- end-to-end verification (a live PATCH /shgs/:id 500'd with "value too
-- long for the column's type"), not assumed.
ALTER TABLE "shg" ALTER COLUMN "bank_ifsc" TYPE VARCHAR(255);
