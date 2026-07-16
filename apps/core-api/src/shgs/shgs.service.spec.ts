import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ShgsService } from './shgs.service';

describe('ShgsService', () => {
  let prisma: any;
  let geo: {
    setLocation: jest.Mock;
    getLocation: jest.Mock;
    findNearbyIds: jest.Mock;
  };
  let service: ShgsService;

  const shgRow = {
    id: 'shg-1',
    contactUserId: 'user-1',
    districtId: 'dist-1',
    ulbId: null,
  };

  beforeEach(() => {
    prisma = {
      shg: {
        create: jest.fn().mockResolvedValue(shgRow),
        findUnique: jest.fn().mockResolvedValue(shgRow),
        findMany: jest.fn().mockResolvedValue([shgRow]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(shgRow),
        delete: jest.fn().mockResolvedValue(shgRow),
      },
      role: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'role-shg', name: 'SHG' }),
      },
      userRole: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    geo = {
      setLocation: jest.fn().mockResolvedValue(undefined),
      getLocation: jest.fn().mockResolvedValue(null),
      findNearbyIds: jest.fn(),
    };
    service = new ShgsService(prisma, geo as any);
  });

  describe('create', () => {
    const dto = { name: 'Test SHG', type: 'FOOD', districtId: 'dist-1' } as any;

    it('creates the SHG and auto-assigns the SHG role to the contact user', async () => {
      await service.create('user-1', dto);
      expect(prisma.shg.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contactUserId: 'user-1' }),
        }),
      );
      expect(prisma.userRole.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', roleId: 'role-shg' },
      });
    });

    it('does not duplicate the SHG role if the user already has it', async () => {
      prisma.userRole.findFirst.mockResolvedValueOnce({ id: 'existing' });
      await service.create('user-1', dto);
      expect(prisma.userRole.create).not.toHaveBeenCalled();
    });

    it('sets the geo location when lat/lng are both provided', async () => {
      await service.create('user-1', { ...dto, lat: 14.68, lng: 77.6 });
      expect(geo.setLocation).toHaveBeenCalledWith('shg', 'shg-1', {
        lat: 14.68,
        lng: 77.6,
      });
    });

    it('rejects a lat without a matching lng', async () => {
      await expect(
        service.create('user-1', { ...dto, lat: 14.68 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update / remove — ownership', () => {
    it('allows the owning contact user to update', async () => {
      await expect(
        service.update('shg-1', 'user-1', false, {}),
      ).resolves.toBeDefined();
    });

    it("allows an admin to update someone else's SHG", async () => {
      await expect(
        service.update('shg-1', 'someone-else', true, {}),
      ).resolves.toBeDefined();
    });

    it('rejects a non-owner, non-admin update', async () => {
      await expect(
        service.update('shg-1', 'someone-else', false, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for a missing SHG', async () => {
      prisma.shg.findUnique.mockResolvedValueOnce(null);
      await expect(service.remove('missing', 'user-1', false)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllInScope', () => {
    it('scopes to the district for a DISTRICT_OFFICIAL', async () => {
      await service.findAllInScope(
        { kind: 'district', districtIds: ['dist-1'] },
        { skip: 0, pageSize: 20, page: 1 } as any,
      );
      expect(prisma.shg.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ districtId: { in: ['dist-1'] } }),
        }),
      );
    });

    it("scopes to only the caller's own SHGs for a plain SHG member", async () => {
      await service.findAllInScope({ kind: 'self', userId: 'user-1' }, {
        skip: 0,
        pageSize: 20,
        page: 1,
      } as any);
      expect(prisma.shg.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ contactUserId: 'user-1' }),
        }),
      );
    });
  });
});
