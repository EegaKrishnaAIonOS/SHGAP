import {
  createAuthorizationHeader,
  digestBody,
  generateSigningKeyPair,
  verifySignature,
} from './beckn-signing.util';

describe('beckn-signing.util', () => {
  describe('digestBody', () => {
    it('produces a stable base64 digest for the same body', () => {
      const digest1 = digestBody('{"a":1}');
      const digest2 = digestBody('{"a":1}');
      expect(digest1).toBe(digest2);
    });

    it('produces a different digest for a different body', () => {
      expect(digestBody('{"a":1}')).not.toBe(digestBody('{"a":2}'));
    });
  });

  describe('createAuthorizationHeader / verifySignature (real Ed25519 round-trip)', () => {
    it('produces a signature that verifies against the matching public key', () => {
      const { privateKey, publicKey } = generateSigningKeyPair();
      const created = 1000;
      const expires = 1300;
      const digestBase64 = digestBody('the request body');

      const header = createAuthorizationHeader({
        keyId: 'subscriber|key-1|ed25519',
        privateKey,
        created,
        expires,
        digestBase64,
      });

      const signatureMatch = /signature="([^"]+)"/.exec(header);
      expect(signatureMatch).not.toBeNull();

      const verified = verifySignature({
        publicKey,
        created,
        expires,
        digestBase64,
        signatureBase64: signatureMatch![1],
      });
      expect(verified).toBe(true);
    });

    it('fails verification when the body digest was tampered with after signing', () => {
      const { privateKey, publicKey } = generateSigningKeyPair();
      const created = 1000;
      const expires = 1300;

      const header = createAuthorizationHeader({
        keyId: 'subscriber|key-1|ed25519',
        privateKey,
        created,
        expires,
        digestBase64: digestBody('original body'),
      });
      const signatureMatch = /signature="([^"]+)"/.exec(header)!;

      const verified = verifySignature({
        publicKey,
        created,
        expires,
        digestBase64: digestBody('tampered body'),
        signatureBase64: signatureMatch[1],
      });
      expect(verified).toBe(false);
    });

    it('fails verification against a different keypair entirely', () => {
      const signer = generateSigningKeyPair();
      const impostor = generateSigningKeyPair();
      const created = 1000;
      const expires = 1300;
      const digestBase64 = digestBody('the request body');

      const header = createAuthorizationHeader({
        keyId: 'subscriber|key-1|ed25519',
        privateKey: signer.privateKey,
        created,
        expires,
        digestBase64,
      });
      const signatureMatch = /signature="([^"]+)"/.exec(header)!;

      const verified = verifySignature({
        publicKey: impostor.publicKey,
        created,
        expires,
        digestBase64,
        signatureBase64: signatureMatch[1],
      });
      expect(verified).toBe(false);
    });

    it('includes the real Beckn Authorization header fields', () => {
      const { privateKey } = generateSigningKeyPair();
      const header = createAuthorizationHeader({
        keyId: 'shgap.demo.ondc.local|demo-key-1|ed25519',
        privateKey,
        created: 1000,
        expires: 1300,
        digestBase64: digestBody('body'),
      });

      expect(header).toContain('algorithm="ed25519"');
      expect(header).toContain(
        'keyId="shgap.demo.ondc.local|demo-key-1|ed25519"',
      );
      expect(header).toContain('headers="(created) (expires) digest"');
    });
  });
});
