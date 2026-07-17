import { MasterDataService } from './master-data.service';

describe('MasterDataService', () => {
  let prisma: any;
  let service: MasterDataService;

  beforeEach(() => {
    prisma = {
      district: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'd1', name: 'Anantapur' }]),
      },
      ulb: { findMany: jest.fn().mockResolvedValue([]) },
      mandal: { findMany: jest.fn().mockResolvedValue([]) },
      category: { findMany: jest.fn().mockResolvedValue([]) },
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
});
