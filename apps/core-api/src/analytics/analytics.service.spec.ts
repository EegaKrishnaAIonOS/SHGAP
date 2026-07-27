import { NotFoundException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let prisma: { $queryRaw: jest.Mock; $executeRaw: jest.Mock };
  let redis: { get: jest.Mock; set: jest.Mock };
  let service: AnalyticsService;

  const globalScope = { kind: 'global' as const };
  const emptyFilters = { page: 1, pageSize: 20, skip: 0 } as any;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };
    service = new AnalyticsService(prisma as any, redis as any);
  });

  describe('districtSales', () => {
    it('maps raw rows to camelCase with numeric conversions', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          district_id: 'd1',
          district_name: 'Anantapur',
          order_count: 5n,
          total_quantity: '120.50',
          total_amount: '18000.00',
        },
      ]);

      const result = await service.districtSales(globalScope, emptyFilters);

      expect(result).toEqual([
        {
          districtId: 'd1',
          districtName: 'Anantapur',
          orderCount: 5,
          totalQuantity: 120.5,
          totalAmount: 18000,
        },
      ]);
    });

    it('caches the result under a deterministic key', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);
      await service.districtSales(globalScope, emptyFilters);
      expect(redis.set).toHaveBeenCalledTimes(1);
    });
  });

  describe('recommendationSummary', () => {
    it('computes acceptance rate from accepted/rejected only, excluding pending', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { status: 'PENDING', count: 3n },
        { status: 'ACCEPTED', count: 6n },
        { status: 'REJECTED', count: 4n },
      ]);

      const result = await service.recommendationSummary(
        globalScope,
        emptyFilters,
      );

      expect(result.total).toBe(13);
      expect(result.pending).toBe(3);
      expect(result.accepted).toBe(6);
      expect(result.rejected).toBe(4);
      // 6 accepted out of 10 responded (6 accepted + 4 rejected) = 0.6
      expect(result.acceptanceRate).toBeCloseTo(0.6);
    });

    it('returns null (not 0) acceptance rate when nothing has been responded to yet', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { status: 'PENDING', count: 4n },
      ]);

      const result = await service.recommendationSummary(
        globalScope,
        emptyFilters,
      );

      expect(result.acceptanceRate).toBeNull();
    });
  });

  describe('shgDetail', () => {
    it('throws NotFoundException when the SHG does not exist (or is out of scope)', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);
      await expect(service.shgDetail('missing', globalScope)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the SHG rollup with its product breakdown', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([
          {
            id: 'shg-1',
            name: 'Sri Lakshmi Pickles SHG',
            type: 'FOOD',
            is_active: true,
            district_id: 'd1',
            district_name: 'Anantapur',
            ulb_id: null,
            ulb_name: null,
            total_sales_amount: '50000.00',
            total_sales_quantity: '300.00',
            order_count: 120n,
            enquiry_count: 2n,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'p1',
            name: 'Mango Pickle',
            category_name: 'Pickles',
            price: '150.00',
            units_sold: '200.00',
            total_revenue: '30000.00',
          },
        ]);

      const result = await service.shgDetail('shg-1', globalScope);

      expect(result).toMatchObject({
        id: 'shg-1',
        name: 'Sri Lakshmi Pickles SHG',
        totalSalesAmount: 50000,
        orderCount: 120,
      });
      expect(result.products).toEqual([
        {
          id: 'p1',
          name: 'Mango Pickle',
          categoryName: 'Pickles',
          price: 150,
          unitsSold: 200,
          totalRevenue: 30000,
        },
      ]);
    });
  });

  describe('shgs', () => {
    it('returns a paginated result built from the rows + count queries', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([
          {
            id: 'shg-1',
            name: 'Test SHG',
            type: 'FOOD',
            is_active: true,
            district_id: 'd1',
            district_name: 'Anantapur',
            ulb_id: null,
            ulb_name: null,
            product_count: 3n,
            total_sales_amount: '1000.00',
            total_sales_quantity: '10.00',
            order_count: 5n,
            enquiry_count: 1n,
          },
        ])
        .mockResolvedValueOnce([{ count: 1n }]);

      const result = await service.shgs(globalScope, emptyFilters);

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect((result.items[0] as any).productCount).toBe(3);
    });
  });

  describe('refreshViews', () => {
    it('refreshes all three materialized views', async () => {
      prisma.$executeRaw.mockResolvedValue(undefined);

      const result = await service.refreshViews();

      expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
      expect(result.views).toEqual([
        'mv_sales_facts',
        'mv_enquiry_facts',
        'mv_recommendation_facts',
      ]);
    });
  });
});
