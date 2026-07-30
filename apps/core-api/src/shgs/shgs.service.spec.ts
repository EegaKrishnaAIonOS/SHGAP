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
  let pii: { encrypt: jest.Mock; decrypt: jest.Mock };
  let service: ShgsService;

  const shgRow = {
    id: 'shg-1',
    contactUserId: 'user-1',
    districtId: 'dist-1',
    ulbId: null,
    bankAccountNumber: null,
    bankIfsc: null,
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
    pii = {
      encrypt: jest.fn((plaintext: string) =>
        Promise.resolve(`encrypted:${plaintext}`),
      ),
      decrypt: jest.fn((ciphertext: string | null) =>
        Promise.resolve(ciphertext),
      ),
    };
    service = new ShgsService(prisma, geo as any, pii as any);
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

    it('encrypts bank account/IFSC before writing, never storing them as plaintext (T22)', async () => {
      await service.create('user-1', {
        ...dto,
        bankAccountNumber: '1234567890',
        bankIfsc: 'SBIN0001234',
      });
      expect(pii.encrypt).toHaveBeenCalledWith('1234567890');
      expect(pii.encrypt).toHaveBeenCalledWith('SBIN0001234');
      expect(prisma.shg.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bankAccountNumber: 'encrypted:1234567890',
            bankIfsc: 'encrypted:SBIN0001234',
          }),
        }),
      );
    });

    it('does not attempt to encrypt bank fields that were not provided', async () => {
      await service.create('user-1', dto);
      expect(pii.encrypt).not.toHaveBeenCalled();
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

    it('encrypts a newly-set bank account number on update', async () => {
      await service.update('shg-1', 'user-1', false, {
        bankAccountNumber: '9999999999',
      } as any);
      expect(pii.encrypt).toHaveBeenCalledWith('9999999999');
      expect(prisma.shg.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bankAccountNumber: 'encrypted:9999999999',
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('decrypts bank account/IFSC before returning the SHG (T22)', async () => {
      prisma.shg.findUnique.mockResolvedValueOnce({
        ...shgRow,
        bankAccountNumber: 'ciphertext-account',
        bankIfsc: 'ciphertext-ifsc',
      });

      const result = await service.findOne('shg-1');

      expect(pii.decrypt).toHaveBeenCalledWith('ciphertext-account');
      expect(pii.decrypt).toHaveBeenCalledWith('ciphertext-ifsc');
      expect(result.bankAccountNumber).toBe('ciphertext-account');
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

    it('adds a case-insensitive name filter when search is provided', async () => {
      await service.findAllInScope({ kind: 'global' }, {
        skip: 0,
        pageSize: 20,
        page: 1,
        search: 'lakshmi',
      } as any);
      expect(prisma.shg.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'lakshmi', mode: 'insensitive' },
          }),
        }),
      );
    });
  });
});
