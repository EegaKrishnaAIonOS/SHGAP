import { AdminService } from './admin.service';

describe('AdminService', () => {
  let prisma: any;
  let service: AdminService;

  beforeEach(() => {
    prisma = {
      shg: { count: jest.fn().mockResolvedValue(0) },
      product: { count: jest.fn().mockResolvedValue(0) },
      user: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    service = new AdminService(prisma);
  });

  it('returns global (unfiltered) counts for an admin/state-level scope', async () => {
    await service.summary({ kind: 'global' });
    expect(prisma.shg.count).toHaveBeenNthCalledWith(1, { where: {} });
    expect(prisma.product.count).toHaveBeenNthCalledWith(1, { where: {} });
    expect(prisma.user.count).toHaveBeenCalledWith({ where: {} });
  });

  it('scopes SHG/product/user counts to a district for a DISTRICT_OFFICIAL', async () => {
    await service.summary({ kind: 'district', districtIds: ['dist-1'] });
    expect(prisma.shg.count).toHaveBeenNthCalledWith(1, {
      where: { districtId: { in: ['dist-1'] } },
    });
    expect(prisma.product.count).toHaveBeenNthCalledWith(1, {
      where: { shg: { districtId: { in: ['dist-1'] } } },
    });
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { userRoles: { some: { districtId: { in: ['dist-1'] } } } },
    });
  });

  it('adds an isActive/isAvailable filter for the second (active/available) count', async () => {
    await service.summary({ kind: 'global' });
    expect(prisma.shg.count).toHaveBeenNthCalledWith(2, {
      where: { isActive: true },
    });
    expect(prisma.product.count).toHaveBeenNthCalledWith(2, {
      where: { isAvailable: true },
    });
  });

  it('shapes the response with all five summary fields', async () => {
    prisma.shg.count.mockResolvedValueOnce(10).mockResolvedValueOnce(8);
    prisma.product.count.mockResolvedValueOnce(50).mockResolvedValueOnce(45);
    prisma.user.count.mockResolvedValueOnce(20);

    const result = await service.summary({ kind: 'global' });

    expect(result).toEqual({
      totalShgs: 10,
      activeShgs: 8,
      totalProducts: 50,
      availableProducts: 45,
      totalUsers: 20,
    });
  });
});
