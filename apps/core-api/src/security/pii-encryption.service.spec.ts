import { PiiEncryptionService } from './pii-encryption.service';

describe('PiiEncryptionService', () => {
  let prisma: { $queryRaw: jest.Mock };
  let kms: { getPiiEncryptionKey: jest.Mock };
  let service: PiiEncryptionService;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn() };
    kms = { getPiiEncryptionKey: jest.fn().mockResolvedValue('test-key') };
    service = new PiiEncryptionService(prisma as any, kms as any);
  });

  describe('encrypt', () => {
    it('asks pgcrypto to encrypt the plaintext with the KMS-supplied key', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { encrypted: 'base64-ciphertext' },
      ]);

      const result = await service.encrypt('1234567890');

      expect(result).toBe('base64-ciphertext');
      expect(kms.getPiiEncryptionKey).toHaveBeenCalled();
    });
  });

  describe('decrypt', () => {
    it('returns null for a null/undefined ciphertext without calling pgcrypto', async () => {
      expect(await service.decrypt(null)).toBeNull();
      expect(await service.decrypt(undefined)).toBeNull();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('decrypts real ciphertext back to plaintext', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ decrypted: '1234567890' }]);

      const result = await service.decrypt('base64-ciphertext');

      expect(result).toBe('1234567890');
    });

    it('falls back to returning the raw value when it is legacy plaintext, not ciphertext', async () => {
      prisma.$queryRaw.mockRejectedValueOnce(
        new Error('not a valid PGP message'),
      );

      const result = await service.decrypt('SBIN0001234');

      expect(result).toBe('SBIN0001234');
    });
  });
});
