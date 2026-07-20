import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let prisma: any;
  let service: UsersService;

  const userRow = { id: 'user-1', phone: '9000000001', name: 'Ramesh' };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(userRow),
        findMany: jest.fn().mockResolvedValue([userRow]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue(userRow),
        update: jest.fn().mockResolvedValue(userRow),
        delete: jest.fn().mockResolvedValue(userRow),
      },
      role: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'role-1', name: 'DISTRICT_OFFICIAL' }),
      },
      userRole: {
        create: jest.fn().mockResolvedValue({ id: 'ur-1' }),
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'ur-1', userId: 'user-1' }),
        delete: jest.fn().mockResolvedValue({ id: 'ur-1' }),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    service = new UsersService(prisma);
  });

  describe('findAllInScope', () => {
    it('scopes to the district for a DISTRICT_OFFICIAL', async () => {
      await service.findAllInScope(
        { kind: 'district', districtIds: ['dist-1'] },
        { skip: 0, pageSize: 20, page: 1 } as any,
      );
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userRoles: { some: { districtId: { in: ['dist-1'] } } },
          }),
        }),
      );
    });

    it('searches by name or phone, case-insensitively on name', async () => {
      await service.findAllInScope({ kind: 'global' }, {
        skip: 0,
        pageSize: 20,
        page: 1,
        search: 'ramesh',
      } as any);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'ramesh', mode: 'insensitive' } },
              { phone: { contains: 'ramesh' } },
            ],
          }),
        }),
      );
    });

    it('returns a paginated result shape', async () => {
      const result = await service.findAllInScope({ kind: 'global' }, {
        skip: 0,
        pageSize: 20,
        page: 1,
      } as any);
      expect(result).toEqual(
        expect.objectContaining({
          items: [userRow],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      );
    });
  });

  describe('assignRole', () => {
    it('requires a districtId for DISTRICT_OFFICIAL', async () => {
      await expect(
        service.assignRole('user-1', { role: 'DISTRICT_OFFICIAL' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('requires districtId and ulbId for ULB_OFFICIAL', async () => {
      await expect(
        service.assignRole('user-1', {
          role: 'ULB_OFFICIAL',
          districtId: 'd1',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the role is not seeded', async () => {
      prisma.role.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.assignRole('user-1', { role: 'ADMIN' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeRole', () => {
    it('throws NotFoundException when the role assignment belongs to a different user', async () => {
      prisma.userRole.findUnique.mockResolvedValueOnce({
        id: 'ur-1',
        userId: 'other-user',
      });
      await expect(service.removeRole('user-1', 'ur-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
