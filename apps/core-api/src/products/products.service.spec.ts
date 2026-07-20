import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let prisma: any;
  let geo: {
    setLocation: jest.Mock;
    getLocation: jest.Mock;
    findNearbyIds: jest.Mock;
  };
  let service: ProductsService;

  const shgRow = { id: 'shg-1', contactUserId: 'user-1' };
  const productRow = { id: 'prod-1', shgId: 'shg-1', shg: shgRow };

  beforeEach(() => {
    prisma = {
      shg: { findUnique: jest.fn().mockResolvedValue(shgRow) },
      product: {
        create: jest.fn().mockResolvedValue(productRow),
        findUnique: jest.fn().mockResolvedValue(productRow),
        findMany: jest.fn().mockResolvedValue([productRow]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(productRow),
        delete: jest.fn().mockResolvedValue(productRow),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    geo = {
      setLocation: jest.fn().mockResolvedValue(undefined),
      getLocation: jest.fn().mockResolvedValue(null),
      findNearbyIds: jest.fn().mockResolvedValue([]),
    };
    service = new ProductsService(prisma, geo as any);
  });

  describe('create', () => {
    const dto = {
      shgId: 'shg-1',
      categoryId: 'cat-1',
      name: 'Pickle',
      unit: 'jar',
      price: 100,
    } as any;

    it('creates the product when the caller owns the SHG', async () => {
      await expect(service.create('user-1', false, dto)).resolves.toBeDefined();
      expect(prisma.product.create).toHaveBeenCalled();
    });

    it('rejects when the caller does not own the SHG and is not admin', async () => {
      await expect(service.create('someone-else', false, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows an admin to create a product for any SHG', async () => {
      await expect(
        service.create('someone-else', true, dto),
      ).resolves.toBeDefined();
    });

    it('falls back to the SHG location when the product has none of its own', async () => {
      geo.getLocation.mockResolvedValueOnce({ lat: 14.68, lng: 77.6 }); // resolveInitialLocation's shg lookup
      await service.create('user-1', false, dto);
      expect(geo.setLocation).toHaveBeenCalledWith('products', 'prod-1', {
        lat: 14.68,
        lng: 77.6,
      });
    });

    it('rejects a lat without a matching lng', async () => {
      await expect(
        service.create('user-1', false, { ...dto, lat: 14.68 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('ownership checks on update/remove', () => {
    it('rejects a non-owner, non-admin update', async () => {
      await expect(
        service.update('prod-1', 'someone-else', false, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows the owning SHG contact to update', async () => {
      await expect(
        service.update('prod-1', 'user-1', false, {}),
      ).resolves.toBeDefined();
    });

    it('throws NotFoundException for a missing product', async () => {
      prisma.product.findUnique.mockResolvedValueOnce(null);
      await expect(service.remove('missing', 'user-1', false)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllInScope', () => {
    it('adds a case-insensitive name filter when search is provided', async () => {
      await service.findAllInScope({ kind: 'global' }, {
        skip: 0,
        pageSize: 20,
        page: 1,
        search: 'pickle',
      } as any);
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'pickle', mode: 'insensitive' },
          }),
        }),
      );
    });
  });

  describe('findNearby', () => {
    it('returns an empty array when nothing is within range', async () => {
      const result = await service.findNearby({ lat: 14.68, lng: 77.6 }, 25);
      expect(result).toEqual([]);
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('orders results by ascending distance', async () => {
      geo.findNearbyIds.mockResolvedValueOnce([
        { id: 'prod-2', distanceKm: 10 },
        { id: 'prod-1', distanceKm: 2 },
      ]);
      prisma.product.findMany.mockResolvedValueOnce([
        { id: 'prod-1', shgId: 'shg-1', shg: shgRow },
        { id: 'prod-2', shgId: 'shg-1', shg: shgRow },
      ]);
      const result = await service.findNearby({ lat: 14.68, lng: 77.6 }, 25);
      expect(result.map((r: any) => r.id)).toEqual(['prod-1', 'prod-2']);
      expect(result[0].distanceKm).toBe(2);
    });
  });
});
