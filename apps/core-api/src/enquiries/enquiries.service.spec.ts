import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EnquiriesService } from './enquiries.service';

describe('EnquiriesService', () => {
  let prisma: any;
  let service: EnquiriesService;

  const userRow = { id: 'user-1', name: 'Ravi Kumar' };
  const buyerRow = { id: 'buyer-1', contactUserId: 'user-1', name: 'Ravi Kumar' };
  const productRow = { id: 'prod-1', shgId: 'shg-1' };
  const shgRow = { id: 'shg-1', contactUserId: 'shg-owner' };
  const enquiryRow = {
    id: 'enq-1',
    buyerId: 'buyer-1',
    productId: 'prod-1',
    shgId: 'shg-1',
    status: 'OPEN',
    shg: shgRow,
  };

  beforeEach(() => {
    prisma = {
      buyer: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(buyerRow),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(userRow),
      },
      role: {
        findUnique: jest.fn().mockResolvedValue({ id: 'role-buyer', name: 'BUYER' }),
      },
      userRole: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      product: {
        findUnique: jest.fn().mockResolvedValue(productRow),
      },
      enquiry: {
        create: jest.fn().mockResolvedValue(enquiryRow),
        findMany: jest.fn().mockResolvedValue([enquiryRow]),
        findUnique: jest.fn().mockResolvedValue(enquiryRow),
        update: jest.fn().mockResolvedValue({ ...enquiryRow, status: 'RESPONDED' }),
      },
    };
    service = new EnquiriesService(prisma);
  });

  describe('getOrCreateBuyerForUser', () => {
    it('creates a new buyer profile and assigns the BUYER role on first use', async () => {
      const result = await service.getOrCreateBuyerForUser('user-1');
      expect(prisma.buyer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contactUserId: 'user-1', type: 'RETAIL' }),
        }),
      );
      expect(prisma.userRole.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', roleId: 'role-buyer' },
      });
      expect(result).toEqual(buyerRow);
    });

    it('reuses the existing buyer profile on a second call, without creating another', async () => {
      prisma.buyer.findUnique.mockResolvedValueOnce(buyerRow);
      await service.getOrCreateBuyerForUser('user-1');
      expect(prisma.buyer.create).not.toHaveBeenCalled();
    });

    it('does not duplicate the BUYER role if the user already has it', async () => {
      prisma.userRole.findFirst.mockResolvedValueOnce({ id: 'existing' });
      await service.getOrCreateBuyerForUser('user-1');
      expect(prisma.userRole.create).not.toHaveBeenCalled();
    });

    it("falls back to the user's own name, then a generic label, when no buyerName is given", async () => {
      await service.getOrCreateBuyerForUser('user-1');
      expect(prisma.buyer.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Ravi Kumar' }) }),
      );

      prisma.user.findUnique.mockResolvedValueOnce(null);
      await service.getOrCreateBuyerForUser('user-2');
      expect(prisma.buyer.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Marketplace buyer' }) }),
      );
    });

    it('prefers an explicitly-given buyerName over the profile name', async () => {
      await service.getOrCreateBuyerForUser('user-1', 'Anand Traders');
      expect(prisma.buyer.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Anand Traders' }) }),
      );
    });
  });

  describe('create', () => {
    it("derives shgId from the real product row, never from client input", async () => {
      await service.create('user-1', { productId: 'prod-1' } as any);
      expect(prisma.enquiry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ shgId: 'shg-1', productId: 'prod-1' }),
        }),
      );
    });

    it('throws NotFoundException for a missing product', async () => {
      prisma.product.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.create('user-1', { productId: 'missing' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listSent / listReceived', () => {
    it('scopes listSent to the buyer profile owned by the caller', async () => {
      await service.listSent('user-1');
      expect(prisma.enquiry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { buyer: { contactUserId: 'user-1' } },
        }),
      );
    });

    it("scopes listReceived to the caller's own SHG(s)", async () => {
      await service.listReceived('shg-owner', false);
      expect(prisma.enquiry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { shg: { contactUserId: 'shg-owner' } },
        }),
      );
    });

    it('lets an admin see every enquiry, unscoped', async () => {
      await service.listReceived('someone', true);
      expect(prisma.enquiry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  describe('respond', () => {
    it("allows the enquiry's own SHG contact to respond", async () => {
      await expect(
        service.respond('enq-1', 'shg-owner', false, { status: 'RESPONDED' } as any),
      ).resolves.toBeDefined();
      expect(prisma.enquiry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'RESPONDED' }),
        }),
      );
    });

    it('allows an admin to respond on behalf of any SHG', async () => {
      await expect(
        service.respond('enq-1', 'someone-else', true, { status: 'CLOSED' } as any),
      ).resolves.toBeDefined();
    });

    it('rejects a stranger (not the SHG contact, not admin)', async () => {
      await expect(
        service.respond('enq-1', 'someone-else', false, { status: 'RESPONDED' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for a missing enquiry', async () => {
      prisma.enquiry.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.respond('missing', 'shg-owner', false, { status: 'RESPONDED' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
});