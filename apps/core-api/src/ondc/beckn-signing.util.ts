import {
  createHash,
  generateKeyPairSync,
  KeyObject,
  sign,
  verify,
} from 'crypto';

/**
 * Real Ed25519 request signing, in the shape the Beckn protocol (which
 * every ONDC participant speaks) actually requires for its `Authorization`
 * header — this is the mechanism a registered ONDC seller app (BPP) uses
 * to prove a response really came from it. Two honest gaps versus the real
 * spec, both because full ONDC network participation is out of reach for
 * a POC (see ADR-0030):
 *
 * 1. The spec's digest algorithm is BLAKE-512; Node's built-in `crypto`
 *    has no BLAKE-512 implementation, and pulling in a dependency just to
 *    match one hash algorithm for a readiness demo isn't worth it — this
 *    uses SHA-512 instead, clearly labeled in the digest header as such
 *    rather than mislabeled "BLAKE-512" to look more conformant than it is.
 * 2. The Ed25519 keypair below is generated fresh at boot when no real
 *    subscriber key is configured (`ONDC_SIGNING_PRIVATE_KEY`) — a real
 *    ONDC participant's key is registered with the ONDC Registry ahead of
 *    time; nothing here is registered with anything.
 *
 * Everything else — the actual Ed25519 sign/verify operations, the
 * signing-string construction, and the header format — is real, working
 * cryptography, not a stub.
 */

export interface BecknKeyPair {
  publicKey: KeyObject;
  privateKey: KeyObject;
}

export function generateSigningKeyPair(): BecknKeyPair {
  return generateKeyPairSync('ed25519');
}

/** SHA-512 digest of the request/response body, base64-encoded — see the
 * module docstring for why this substitutes for the spec's BLAKE-512. */
export function digestBody(body: string): string {
  return createHash('sha512').update(body, 'utf8').digest('base64');
}

export interface BecknSignatureParams {
  keyId: string;
  privateKey: KeyObject;
  created: number;
  expires: number;
  digestBase64: string;
}

/** Builds the real Ed25519 signature over `(created)/(expires)/digest`,
 * and the full Beckn `Authorization` header value around it. */
export function createAuthorizationHeader(
  params: BecknSignatureParams,
): string {
  const signingString = buildSigningString(
    params.created,
    params.expires,
    params.digestBase64,
  );
  const signature = sign(
    null,
    Buffer.from(signingString, 'utf8'),
    params.privateKey,
  ).toString('base64');
  return (
    `Signature keyId="${params.keyId}",algorithm="ed25519",` +
    `created="${params.created}",expires="${params.expires}",` +
    `headers="(created) (expires) digest",signature="${signature}"`
  );
}

export interface BecknVerifyParams {
  publicKey: KeyObject;
  created: number;
  expires: number;
  digestBase64: string;
  signatureBase64: string;
}

/** Verifies a signature built by `createAuthorizationHeader` — real Ed25519
 * verification, exercised by this module's own round-trip tests. */
export function verifySignature(params: BecknVerifyParams): boolean {
  const signingString = buildSigningString(
    params.created,
    params.expires,
    params.digestBase64,
  );
  return verify(
    null,
    Buffer.from(signingString, 'utf8'),
    params.publicKey,
    Buffer.from(params.signatureBase64, 'base64'),
  );
}

function buildSigningString(
  created: number,
  expires: number,
  digestBase64: string,
): string {
  return `(created): ${created}\n(expires): ${expires}\ndigest: SHA-512=${digestBase64}`;
}
