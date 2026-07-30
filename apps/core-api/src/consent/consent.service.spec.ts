import { ConsentService } from './consent.service';

describe('ConsentService', () => {
  let prisma: any;
  let audit: { record: jest.Mock };
  let service: ConsentService;

  beforeEach(() => {
    prisma = {
      consent: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new ConsentService(prisma, audit as any);
  });

  describe('grant', () => {
    it('creates a new consent row tied to the current privacy notice version, and audits it', async () => {
      prisma.consent.create.mockResolvedValue({
        id: 'consent-1',
        granted: true,
        version: '2026-07-v1',
        grantedAt: new Date('2026-07-29T00:00:00Z'),
        withdrawnAt: null,
      });

      const result = await service.grant(
        'user-1',
        'MARKETING_NOTIFICATIONS',
        '127.0.0.1',
      );

      expect(prisma.consent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          purpose: 'MARKETING_NOTIFICATIONS',
          granted: true,
          version: '2026-07-v1',
        },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONSENT_GRANTED',
          entityId: 'consent-1',
        }),
      );
      expect(result.active).toBe(true);
      expect(result.notice.title).toBe('Marketing & opportunity notifications');
    });
  });

  describe('withdraw', () => {
    it('sets withdrawnAt on the latest active grant, and audits it', async () => {
      prisma.consent.findFirst.mockResolvedValue({
        id: 'consent-1',
        granted: true,
        version: '2026-07-v1',
        grantedAt: new Date('2026-07-29T00:00:00Z'),
        withdrawnAt: null,
      });
      prisma.consent.update.mockResolvedValue({
        id: 'consent-1',
        granted: true,
        version: '2026-07-v1',
        grantedAt: new Date('2026-07-29T00:00:00Z'),
        withdrawnAt: new Date('2026-07-29T01:00:00Z'),
      });

      const result = await service.withdraw(
        'user-1',
        'MARKETING_NOTIFICATIONS',
      );

      expect(prisma.consent.update).toHaveBeenCalledWith({
        where: { id: 'consent-1' },
        data: { withdrawnAt: expect.any(Date) },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CONSENT_WITHDRAWN' }),
      );
      expect(result.active).toBe(false);
    });

    it('is a harmless no-op when nothing was ever granted', async () => {
      prisma.consent.findFirst.mockResolvedValue(null);

      const result = await service.withdraw(
        'user-1',
        'MARKETING_NOTIFICATIONS',
      );

      expect(prisma.consent.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
      expect(result.active).toBe(false);
    });

    it('is a harmless no-op when already withdrawn', async () => {
      prisma.consent.findFirst.mockResolvedValue({
        id: 'consent-1',
        granted: true,
        version: '2026-07-v1',
        grantedAt: new Date(),
        withdrawnAt: new Date(),
      });

      await service.withdraw('user-1', 'MARKETING_NOTIFICATIONS');

      expect(prisma.consent.update).not.toHaveBeenCalled();
    });
  });

  describe('hasActiveConsent', () => {
    it('is true only when the latest row is granted and not withdrawn', async () => {
      prisma.consent.findFirst.mockResolvedValue({
        granted: true,
        withdrawnAt: null,
      });
      await expect(
        service.hasActiveConsent('user-1', 'MARKETING_NOTIFICATIONS'),
      ).resolves.toBe(true);
    });

    it('is false when withdrawn', async () => {
      prisma.consent.findFirst.mockResolvedValue({
        granted: true,
        withdrawnAt: new Date(),
      });
      await expect(
        service.hasActiveConsent('user-1', 'MARKETING_NOTIFICATIONS'),
      ).resolves.toBe(false);
    });

    it('is false when nothing was ever granted', async () => {
      prisma.consent.findFirst.mockResolvedValue(null);
      await expect(
        service.hasActiveConsent('user-1', 'MARKETING_NOTIFICATIONS'),
      ).resolves.toBe(false);
    });
  });

  describe('listCurrent', () => {
    it('returns a status for every consent purpose, not just ones ever granted', async () => {
      prisma.consent.findFirst.mockResolvedValue(null);
      const result = await service.listCurrent('user-1');
      expect(result).toHaveLength(5);
      expect(result.every((s) => s.active === false)).toBe(true);
    });
  });
});
