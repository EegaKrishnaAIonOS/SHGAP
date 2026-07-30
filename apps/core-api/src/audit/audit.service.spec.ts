import { AuditService } from './audit.service';

describe('AuditService', () => {
  let prisma: any;
  let service: AuditService;
  let store: any[];

  beforeEach(() => {
    store = [];
    prisma = {
      auditLog: {
        findFirst: jest.fn(() => {
          const sorted = [...store].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
          );
          return Promise.resolve(sorted[0] ?? null);
        }),
        create: jest.fn((args: any) => {
          const row = {
            id: `row-${store.length + 1}`,
            createdAt: new Date(Date.now() + store.length),
            ...args.data,
          };
          store.push(row);
          return Promise.resolve(row);
        }),
        findMany: jest.fn(() =>
          Promise.resolve(
            [...store].sort(
              (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
            ),
          ),
        ),
        count: jest.fn(() => Promise.resolve(store.length)),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    service = new AuditService(prisma);
  });

  describe('record + verifyChain', () => {
    it('chains each new entry to the previous one and verifies clean', async () => {
      await service.record({
        action: 'POST /shgs',
        entityType: 'Shg',
        entityId: 'shg-1',
        afterState: { name: 'Sri Lakshmi Pickles SHG' },
      });
      await service.record({
        action: 'PATCH /shgs/shg-1',
        entityType: 'Shg',
        entityId: 'shg-1',
        beforeState: { name: 'Sri Lakshmi Pickles SHG' },
        afterState: { name: 'Sri Lakshmi Pickles SHG (renamed)' },
      });

      expect(store[0].previousHash).toBeNull();
      expect(store[1].previousHash).toBe(store[0].hash);

      const result = await service.verifyChain();
      expect(result).toEqual({
        valid: true,
        totalChecked: 2,
        brokenAtId: null,
      });
    });

    it("detects tampering with a historical row's state", async () => {
      await service.record({
        action: 'POST /shgs',
        entityType: 'Shg',
        entityId: 'shg-1',
        afterState: { name: 'Original name' },
      });
      await service.record({
        action: 'PATCH /shgs/shg-1',
        entityType: 'Shg',
        entityId: 'shg-1',
        afterState: { name: 'Second write' },
      });

      // Simulate someone editing history directly in the DB.
      store[0].afterState = { name: 'Tampered name' };

      const result = await service.verifyChain();
      expect(result.valid).toBe(false);
      expect(result.brokenAtId).toBe(store[0].id);
    });

    it('hashes a real Date object in afterState the same way it hashes the ISO string Postgres returns for it (T22 regression)', async () => {
      // AuditInterceptor passes the controller's raw return value, which
      // can carry real Date instances (e.g. Prisma's own createdAt/
      // updatedAt) — not yet serialized to strings the way the eventual
      // HTTP response body would be.
      await service.record({
        action: 'PATCH /shgs/shg-1',
        entityType: 'Shg',
        entityId: 'shg-1',
        afterState: { updatedAt: new Date('2026-07-30T16:27:30.847Z') },
      });

      // Simulate reading the same row back after a real Postgres JSONB
      // round-trip, where dates always come back as plain ISO strings.
      store[0].afterState = { updatedAt: '2026-07-30T16:27:30.847Z' };

      const result = await service.verifyChain();
      expect(result.valid).toBe(true);
    });

    it('is not sensitive to incidental JSON key ordering (Postgres jsonb round-trip safety)', async () => {
      await service.record({
        action: 'POST /shgs',
        entityType: 'Shg',
        entityId: 'shg-1',
        afterState: { a: 1, b: 2 },
      });

      // Simulate Postgres returning the same JSON object with keys in a
      // different order — should NOT be treated as tampering.
      store[0].afterState = { b: 2, a: 1 };

      const result = await service.verifyChain();
      expect(result.valid).toBe(true);
    });

    it('starts the very first row with a null previousHash', async () => {
      await service.record({
        action: 'POST /shgs',
        entityType: 'Shg',
        entityId: 'shg-1',
      });
      expect(store[0].previousHash).toBeNull();
    });
  });

  describe('findAll', () => {
    it('filters by entityType', async () => {
      await service.findAll({
        entityType: 'Shg',
        skip: 0,
        pageSize: 20,
        page: 1,
      } as any);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entityType: 'Shg' }),
        }),
      );
    });
  });
});
