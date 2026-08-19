import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  let prisma: any;
  let service: AdminService;

  beforeEach(() => {
    prisma = {
      shg: { count: jest.fn().mockResolvedValue(0) },
      product: { count: jest.fn().mockResolvedValue(0) },
      user: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
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

  describe('listPendingUsers', () => {
    it('filters to PENDING_APPROVAL users holding the SHG or DISTRIBUTOR role', async () => {
      await service.listPendingUsers();
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'PENDING_APPROVAL',
            userRoles: {
              some: { role: { name: { in: ['SHG', 'DISTRIBUTOR'] } } },
            },
          },
        }),
      );
    });

    it('never returns passwordHash, even if Prisma returns it', async () => {
      prisma.user.findMany.mockResolvedValueOnce([
        {
          id: 'user-1',
          status: 'PENDING_APPROVAL',
          passwordHash: 'super-secret-hash',
        },
      ]);
      const result = await service.listPendingUsers();
      expect(result[0]).not.toHaveProperty('passwordHash');
    });
  });

  describe('approveUser', () => {
    it('flips a PENDING_APPROVAL user to ACTIVE', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        status: 'PENDING_APPROVAL',
      });
      await service.approveUser('user-1');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'ACTIVE' },
      });
    });

    it('never returns passwordHash, even if Prisma returns it', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        status: 'PENDING_APPROVAL',
      });
      prisma.user.update.mockResolvedValueOnce({
        id: 'user-1',
        status: 'ACTIVE',
        passwordHash: 'super-secret-hash',
      });
      const result = await service.approveUser('user-1');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('rejects approving a user that is not pending', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        status: 'ACTIVE',
      });
      await expect(service.approveUser('user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects approving an unknown user', async () => {
      await expect(service.approveUser('nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('rejectUser', () => {
    it('flips a PENDING_APPROVAL user to REJECTED', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        status: 'PENDING_APPROVAL',
      });
      await service.rejectUser('user-1');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'REJECTED' },
      });
    });
  });
});
