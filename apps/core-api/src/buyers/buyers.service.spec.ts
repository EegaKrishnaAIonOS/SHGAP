import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BuyersService } from './buyers.service';

describe('BuyersService', () => {
  let prisma: any;
  let geo: {
    setLocation: jest.Mock;
    getLocation: jest.Mock;
    findNearbyIds: jest.Mock;
  };
  let service: BuyersService;

  const buyerRow = {
    id: 'buyer-1',
    name: 'Test Buyer',
    type: 'RETAIL',
    districtId: 'dist-1',
  };

  beforeEach(() => {
    prisma = {
      buyer: {
        create: jest.fn().mockResolvedValue(buyerRow),
        findUnique: jest.fn().mockResolvedValue(buyerRow),
        findMany: jest.fn().mockResolvedValue([buyerRow]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(buyerRow),
        delete: jest.fn().mockResolvedValue(buyerRow),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    geo = {
      setLocation: jest.fn().mockResolvedValue(undefined),
      getLocation: jest.fn().mockResolvedValue(null),
      findNearbyIds: jest.fn(),
    };
    service = new BuyersService(prisma, geo as any);
  });

  describe('create', () => {
    const dto = { name: 'Test Buyer', type: 'RETAIL' } as any;

    it('creates the buyer', async () => {
      await service.create(dto);
      expect(prisma.buyer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Test Buyer', type: 'RETAIL' }),
        }),
      );
    });

    it('passes categoryIds through as categoryInterests.create', async () => {
      await service.create({ ...dto, categoryIds: ['cat-1', 'cat-2'] });
      expect(prisma.buyer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoryInterests: {
              create: [{ categoryId: 'cat-1' }, { categoryId: 'cat-2' }],
            },
          }),
        }),
      );
    });

    it('serializes the demand profile to a plain JSON object', async () => {
      await service.create({
        ...dto,
        demandProfile: {
          typicalVolume: 100,
          volumeUnit: 'kg',
          frequency: 'MONTHLY',
        },
      });
      expect(prisma.buyer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            demandProfile: expect.objectContaining({
              typicalVolume: 100,
              volumeUnit: 'kg',
              frequency: 'MONTHLY',
            }),
          }),
        }),
      );
    });

    it('sets the geo location when lat/lng are both provided', async () => {
      await service.create({ ...dto, lat: 16.5, lng: 80.6 });
      expect(geo.setLocation).toHaveBeenCalledWith('buyers', 'buyer-1', {
        lat: 16.5,
        lng: 80.6,
      });
    });

    it('rejects a lat without a matching lng', async () => {
      await expect(service.create({ ...dto, lat: 16.5 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('importMany', () => {
    it('creates every buyer and reports a zero failure count on success', async () => {
      const result = await service.importMany({
        buyers: [
          { name: 'Buyer A', type: 'RETAIL' } as any,
          { name: 'Buyer B', type: 'BULK' } as any,
        ],
      });
      expect(result.createdCount).toBe(2);
      expect(result.failedCount).toBe(0);
    });

    it('reports per-row failures without aborting the rest of the batch', async () => {
      // Buyer B has lat without a matching lng — invalid, but must not stop Buyer C.
      const result = await service.importMany({
        buyers: [
          { name: 'Buyer A', type: 'RETAIL' } as any,
          { name: 'Buyer B', type: 'RETAIL', lat: 1 } as any,
          { name: 'Buyer C', type: 'BULK' } as any,
        ],
      });

      expect(result.createdCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.failed[0]).toMatchObject({ index: 1 });
      expect(prisma.buyer.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('update / remove', () => {
    it('updates an existing buyer', async () => {
      await expect(service.update('buyer-1', {} as any)).resolves.toBeDefined();
    });

    it('throws NotFoundException updating a missing buyer', async () => {
      prisma.buyer.findUnique.mockResolvedValueOnce(null);
      await expect(service.update('missing', {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException removing a missing buyer', async () => {
      prisma.buyer.findUnique.mockResolvedValueOnce(null);
      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('replaces category interests wholesale on update', async () => {
      await service.update('buyer-1', { categoryIds: ['cat-3'] } as any);
      expect(prisma.buyer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoryInterests: {
              deleteMany: {},
              create: [{ categoryId: 'cat-3' }],
            },
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('filters by type', async () => {
      await service.findAll({
        type: 'BULK',
        skip: 0,
        pageSize: 20,
        page: 1,
      } as any);
      expect(prisma.buyer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'BULK' }),
        }),
      );
    });

    it('filters by categoryId via the join table', async () => {
      await service.findAll({
        categoryId: 'cat-1',
        skip: 0,
        pageSize: 20,
        page: 1,
      } as any);
      expect(prisma.buyer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoryInterests: { some: { categoryId: 'cat-1' } },
          }),
        }),
      );
    });

    it('adds a case-insensitive name filter when search is provided', async () => {
      await service.findAll({
        search: 'emporium',
        skip: 0,
        pageSize: 20,
        page: 1,
      } as any);
      expect(prisma.buyer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'emporium', mode: 'insensitive' },
          }),
        }),
      );
    });
  });
});
