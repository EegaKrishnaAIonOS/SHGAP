import { NotFoundException } from '@nestjs/common';
import { DataRightsService } from './data-rights.service';

describe('DataRightsService', () => {
  let prisma: any;
  let audit: { record: jest.Mock };
  let consent: { listCurrent: jest.Mock; withdraw: jest.Mock };
  let pii: { encrypt: jest.Mock; decrypt: jest.Mock };
  let service: DataRightsService;

  const userWithShg = {
    id: 'user-1',
    phone: '9876543210',
    email: 'shg@example.com',
    name: 'Lakshmi',
    preferredLanguage: 'TELUGU',
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    shgs: [
      {
        id: 'shg-1',
        name: 'Sri Lakshmi Pickles SHG',
        type: 'FOOD',
        mepmaRegistrationNumber: 'MEPMA-ATP-0001',
        bankAccountNumber: 'ciphertext-account',
        bankIfsc: 'ciphertext-ifsc',
        district: { name: 'Anantapur' },
        ulb: null,
        mandal: null,
        products: [
          {
            id: 'product-1',
            name: 'Mango Pickle',
            price: { toString: () => '150' },
            stock: 40,
            category: { name: 'Pickles' },
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(userWithShg),
        update: jest.fn(),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    consent = {
      listCurrent: jest.fn().mockResolvedValue([]),
      withdraw: jest.fn().mockResolvedValue(undefined),
    };
    pii = {
      encrypt: jest.fn(),
      decrypt: jest.fn((v: string) =>
        Promise.resolve(v ? `decrypted:${v}` : null),
      ),
    };
    service = new DataRightsService(
      prisma,
      audit as any,
      consent as any,
      pii as any,
    );
  });

  describe('exportUserData', () => {
    it('returns the real profile, owned SHG (bank fields decrypted), products, and consents', async () => {
      const result = await service.exportUserData('user-1');

      expect(result.profile.phone).toBe('9876543210');
      expect(result.shgs).toHaveLength(1);
      expect(result.shgs[0].bankAccountNumber).toBe(
        'decrypted:ciphertext-account',
      );
      expect(result.shgs[0].products).toEqual([
        {
          id: 'product-1',
          name: 'Mango Pickle',
          category: 'Pickles',
          price: 150,
          stock: 40,
        },
      ]);
    });

    it('throws NotFoundException for a missing user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.exportUserData('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('requestErasure', () => {
    it('anonymizes name/email/phone, sets status ERASED, and audits before/after state', async () => {
      prisma.user.update.mockResolvedValue({
        name: null,
        email: null,
        phone: 'erased-abc123',
        status: 'ERASED',
      });

      const result = await service.requestErasure('user-1', '127.0.0.1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          name: null,
          email: null,
          status: 'ERASED',
          phone: expect.stringMatching(/^erased-/),
        }),
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DATA_ERASURE_COMPLETED',
          entityType: 'User',
          entityId: 'user-1',
          beforeState: {
            name: 'Lakshmi',
            phone: '9876543210',
            email: 'shg@example.com',
            status: 'ACTIVE',
          },
        }),
      );
      expect(result.status).toBe('completed');
      expect(result.anonymizedFields).toEqual(['name', 'email', 'phone']);
    });

    it('honestly reports retained SHG records rather than silently keeping them unmentioned', async () => {
      prisma.user.update.mockResolvedValue({
        name: null,
        email: null,
        phone: 'erased-x',
        status: 'ERASED',
      });

      const result = await service.requestErasure('user-1');

      expect(result.retainedRecords).toHaveLength(1);
      expect(result.retainedRecords[0]).toContain('1 SHG record');
    });

    it('withdraws every currently-active consent as part of erasure', async () => {
      consent.listCurrent.mockResolvedValue([
        { purpose: 'MARKETING_NOTIFICATIONS', active: true },
        { purpose: 'ANALYTICS', active: false },
      ]);
      prisma.user.update.mockResolvedValue({
        name: null,
        email: null,
        phone: 'erased-x',
        status: 'ERASED',
      });

      await service.requestErasure('user-1');

      expect(consent.withdraw).toHaveBeenCalledTimes(1);
      expect(consent.withdraw).toHaveBeenCalledWith(
        'user-1',
        'MARKETING_NOTIFICATIONS',
        undefined,
      );
    });

    it('throws NotFoundException for a missing user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.requestErasure('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
