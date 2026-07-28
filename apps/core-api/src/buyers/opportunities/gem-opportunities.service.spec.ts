import { NotFoundException } from '@nestjs/common';
import { GemOpportunitiesService } from './gem-opportunities.service';

describe('GemOpportunitiesService', () => {
  let prisma: any;
  let notifications: { dispatch: jest.Mock };
  let service: GemOpportunitiesService;

  const opportunityRow = { id: 'opp-1', buyerId: 'buyer-1', status: 'OPEN' };

  beforeEach(() => {
    prisma = {
      gemOpportunity: {
        create: jest.fn().mockResolvedValue(opportunityRow),
        findUnique: jest.fn().mockResolvedValue(opportunityRow),
        findMany: jest.fn().mockResolvedValue([opportunityRow]),
        count: jest.fn().mockResolvedValue(1),
      },
      shg: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    notifications = { dispatch: jest.fn().mockResolvedValue(true) };
    service = new GemOpportunitiesService(prisma, notifications as any);
  });

  const createDto = {
    buyerId: 'buyer-1',
    categoryId: 'cat-1',
    referenceNumber: 'GEM/2026/B/1',
    title: 'Supply of pickles',
    submissionDeadline: '2026-09-30',
  } as any;

  describe('create', () => {
    it('defaults isSimulated to false for a real write (not a seed)', async () => {
      await service.create(createDto);
      expect(prisma.gemOpportunity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isSimulated: false }),
        }),
      );
    });

    it('dispatches a tender-opportunity alert to every active SHG with a matching-category product', async () => {
      prisma.gemOpportunity.create.mockResolvedValue({
        id: 'opp-1',
        categoryId: 'cat-1',
        title: 'Supply of pickles',
        submissionDeadline: new Date('2026-09-30'),
      });
      prisma.shg.findMany.mockResolvedValue([
        { contactUserId: 'user-1' },
        { contactUserId: 'user-2' },
      ]);

      await service.create(createDto);

      expect(prisma.shg.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            products: { some: { categoryId: 'cat-1' } },
          }),
        }),
      );
      expect(notifications.dispatch).toHaveBeenCalledTimes(2);
      expect(notifications.dispatch).toHaveBeenCalledWith(
        'user-1',
        'TENDER_OPPORTUNITY',
        { tenderTitle: 'Supply of pickles', deadline: '2026-09-30' },
      );
    });

    it('does not attempt to match SHGs when the opportunity has no category', async () => {
      prisma.gemOpportunity.create.mockResolvedValue({
        id: 'opp-1',
        categoryId: null,
        title: 'Untagged tender',
        submissionDeadline: new Date('2026-09-30'),
      });

      await service.create({ ...createDto, categoryId: undefined });

      expect(prisma.shg.findMany).not.toHaveBeenCalled();
      expect(notifications.dispatch).not.toHaveBeenCalled();
    });

    it('does not fail the write when alert dispatch is unreachable (best-effort)', async () => {
      prisma.gemOpportunity.create.mockResolvedValue({
        id: 'opp-1',
        categoryId: 'cat-1',
        title: 'Supply of pickles',
        submissionDeadline: new Date('2026-09-30'),
      });
      prisma.shg.findMany.mockResolvedValue([{ contactUserId: 'user-1' }]);
      notifications.dispatch.mockResolvedValue(false);

      await expect(service.create(createDto)).resolves.toBeDefined();
    });
  });

  describe('importMany', () => {
    it('reports per-row failures without aborting the batch', async () => {
      prisma.gemOpportunity.create
        .mockResolvedValueOnce(opportunityRow)
        .mockRejectedValueOnce(new Error('duplicate referenceNumber'));

      const result = await service.importMany({
        opportunities: [
          createDto,
          { ...createDto, referenceNumber: 'GEM/2026/B/1' },
        ],
      });

      expect(result.createdCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.failed[0]).toEqual({
        index: 1,
        error: 'duplicate referenceNumber',
      });
    });
  });

  describe('findAll', () => {
    it('filters by buyerId', async () => {
      await service.findAll({
        buyerId: 'buyer-1',
        skip: 0,
        pageSize: 20,
        page: 1,
      } as any);
      expect(prisma.gemOpportunity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ buyerId: 'buyer-1' }),
        }),
      );
    });

    it('filters by status', async () => {
      await service.findAll({
        status: 'OPEN',
        skip: 0,
        pageSize: 20,
        page: 1,
      } as any);
      expect(prisma.gemOpportunity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'OPEN' }),
        }),
      );
    });

    it('filters by districtId through the buyer relation', async () => {
      await service.findAll({
        districtId: 'dist-1',
        skip: 0,
        pageSize: 20,
        page: 1,
      } as any);
      expect(prisma.gemOpportunity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ buyer: { districtId: 'dist-1' } }),
        }),
      );
    });

    it('applies no filters when the query is empty', async () => {
      await service.findAll({ skip: 0, pageSize: 20, page: 1 } as any);
      expect(prisma.gemOpportunity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  describe('findOne', () => {
    it('returns the opportunity when found', async () => {
      await expect(service.findOne('opp-1')).resolves.toEqual(opportunityRow);
    });

    it('throws NotFoundException when missing', async () => {
      prisma.gemOpportunity.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
