import { NotFoundException } from '@nestjs/common';
import { GemOpportunitiesService } from './gem-opportunities.service';

describe('GemOpportunitiesService', () => {
  let prisma: any;
  let service: GemOpportunitiesService;

  const opportunityRow = { id: 'opp-1', buyerId: 'buyer-1', status: 'OPEN' };

  beforeEach(() => {
    prisma = {
      gemOpportunity: {
        findUnique: jest.fn().mockResolvedValue(opportunityRow),
        findMany: jest.fn().mockResolvedValue([opportunityRow]),
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    service = new GemOpportunitiesService(prisma);
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
