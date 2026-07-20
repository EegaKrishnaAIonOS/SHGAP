import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@shgap/database';
import { MasterDataService } from './master-data.service';

function fkRestrictError() {
  return new Prisma.PrismaClientKnownRequestError(
    'Foreign key constraint failed',
    {
      code: 'P2003',
      clientVersion: '5.22.0',
    },
  );
}

describe('MasterDataService', () => {
  let prisma: any;
  let service: MasterDataService;

  beforeEach(() => {
    prisma = {
      district: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'd1', name: 'Anantapur' }]),
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'd1', name: 'Anantapur' }),
        create: jest.fn().mockResolvedValue({ id: 'd1' }),
        update: jest.fn().mockResolvedValue({ id: 'd1' }),
        delete: jest.fn().mockResolvedValue({ id: 'd1' }),
      },
      ulb: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: 'u1' }),
        create: jest.fn().mockResolvedValue({ id: 'u1' }),
        update: jest.fn().mockResolvedValue({ id: 'u1' }),
        delete: jest.fn().mockResolvedValue({ id: 'u1' }),
      },
      mandal: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: 'm1' }),
        create: jest.fn().mockResolvedValue({ id: 'm1' }),
        update: jest.fn().mockResolvedValue({ id: 'm1' }),
        delete: jest.fn().mockResolvedValue({ id: 'm1' }),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: 'c1' }),
        create: jest.fn().mockResolvedValue({ id: 'c1' }),
        update: jest.fn().mockResolvedValue({ id: 'c1' }),
        delete: jest.fn().mockResolvedValue({ id: 'c1' }),
      },
      festivalCalendar: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: 'f1' }),
        create: jest.fn().mockResolvedValue({ id: 'f1' }),
        update: jest.fn().mockResolvedValue({ id: 'f1' }),
        delete: jest.fn().mockResolvedValue({ id: 'f1' }),
      },
    };
    service = new MasterDataService(prisma);
  });

  it('lists districts ordered by name', async () => {
    await service.districts();
    expect(prisma.district.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    });
  });

  it('filters ULBs by district', async () => {
    await service.ulbsByDistrict('d1');
    expect(prisma.ulb.findMany).toHaveBeenCalledWith({
      where: { districtId: 'd1' },
      orderBy: { name: 'asc' },
    });
  });

  it('filters mandals by district', async () => {
    await service.mandalsByDistrict('d1');
    expect(prisma.mandal.findMany).toHaveBeenCalledWith({
      where: { districtId: 'd1' },
      orderBy: { name: 'asc' },
    });
  });

  it('lists only top-level categories, with children nested', async () => {
    await service.categories();
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { parentId: null } }),
    );
  });

  describe('districts CRUD', () => {
    it('creates a district', async () => {
      await service.createDistrict({ name: 'Krishna', code: 'KRI' });
      expect(prisma.district.create).toHaveBeenCalledWith({
        data: { name: 'Krishna', code: 'KRI' },
      });
    });

    it('throws 404 updating a district that does not exist', async () => {
      prisma.district.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.updateDistrict('missing', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('converts a foreign-key-restrict delete failure into a 409', async () => {
      prisma.district.delete.mockRejectedValueOnce(fkRestrictError());
      await expect(service.removeDistrict('d1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('ULBs CRUD', () => {
    it('lists all ULBs with district name attached', async () => {
      await service.ulbs();
      expect(prisma.ulb.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { district: { select: { name: true } } },
        }),
      );
    });

    it('converts a foreign-key-restrict delete failure into a 409', async () => {
      prisma.ulb.delete.mockRejectedValueOnce(fkRestrictError());
      await expect(service.removeUlb('u1')).rejects.toThrow(ConflictException);
    });
  });

  describe('mandals CRUD', () => {
    it('converts a foreign-key-restrict delete failure into a 409', async () => {
      prisma.mandal.delete.mockRejectedValueOnce(fkRestrictError());
      await expect(service.removeMandal('m1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('categories CRUD', () => {
    it('creates a category', async () => {
      await service.createCategory({ name: 'Pickles', slug: 'pickles' });
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { name: 'Pickles', slug: 'pickles' },
      });
    });

    it('converts a foreign-key-restrict delete failure into a 409', async () => {
      prisma.category.delete.mockRejectedValueOnce(fkRestrictError());
      await expect(service.removeCategory('c1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('festival calendar CRUD', () => {
    it('creates an entry, converting date strings to Date objects', async () => {
      await service.createFestivalCalendarEntry({
        name: 'Sankranti',
        startDate: '2027-01-14',
        endDate: '2027-01-16',
      });
      const call = prisma.festivalCalendar.create.mock.calls[0][0];
      expect(call.data.startDate).toBeInstanceOf(Date);
      expect(call.data.endDate).toBeInstanceOf(Date);
    });

    it('throws 404 updating an entry that does not exist', async () => {
      prisma.festivalCalendar.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.updateFestivalCalendarEntry('missing', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
