import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { RespondEnquiryDto } from './dto/respond-enquiry.dto';

const enquiryInclude = {
  product: { select: { id: true, name: true } },
  shg: { select: { id: true, name: true } },
  buyer: { select: { id: true, name: true } },
};

@Injectable()
export class EnquiriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Finds the caller's existing buyer profile, or creates a minimal one —
   * mirrors `ShgsService.ensureShgRole`'s auto-assign-on-registration
   * pattern exactly, just for the `BUYER` role instead of `SHG`. There is no
   * separate "become a buyer" signup flow; this is the only way a `Buyer`
   * row ever gets a `contactUserId`. */
  async getOrCreateBuyerForUser(userId: string, displayName?: string) {
    const existing = await this.prisma.buyer.findUnique({
      where: { contactUserId: userId },
    });
    if (existing) return existing;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const buyer = await this.prisma.buyer.create({
      data: {
        name: displayName?.trim() || user?.name || 'Marketplace buyer',
        type: 'RETAIL',
        contactUserId: userId,
      },
    });
    await this.ensureBuyerRole(userId);
    return buyer;
  }

  private async ensureBuyerRole(userId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { name: 'BUYER' } });
    if (!role) return; // role seed not run — nothing to assign, non-fatal
    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId: role.id },
    });
    if (!existing) {
      await this.prisma.userRole.create({ data: { userId, roleId: role.id } });
    }
  }

  /** `shgId` is always derived from the real product row, never trusted
   * from client input. */
  async create(userId: string, dto: CreateEnquiryDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }

    const buyer = await this.getOrCreateBuyerForUser(userId, dto.buyerName);

    return this.prisma.enquiry.create({
      data: {
        buyerId: buyer.id,
        productId: product.id,
        shgId: product.shgId,
        message: dto.message,
      },
      include: enquiryInclude,
    });
  }

  /** The caller's own submitted RFQs — an empty list (not an error) if
   * they've never submitted one. */
  listSent(userId: string) {
    return this.prisma.enquiry.findMany({
      where: { buyer: { contactUserId: userId } },
      include: enquiryInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** RFQs received by the caller's own SHG(s); an admin sees every RFQ. */
  listReceived(userId: string, isAdmin: boolean) {
    return this.prisma.enquiry.findMany({
      where: isAdmin ? {} : { shg: { contactUserId: userId } },
      include: enquiryInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async respond(
    id: string,
    userId: string,
    isAdmin: boolean,
    dto: RespondEnquiryDto,
  ) {
    const enquiry = await this.prisma.enquiry.findUnique({
      where: { id },
      include: { shg: true },
    });
    if (!enquiry) {
      throw new NotFoundException(`Enquiry ${id} not found`);
    }
    if (!isAdmin && enquiry.shg.contactUserId !== userId) {
      throw new ForbiddenException(
        "Only the enquiry's SHG contact or an admin can respond",
      );
    }

    return this.prisma.enquiry.update({
      where: { id },
      data: {
        status: dto.status,
        responseMessage: dto.responseMessage,
        respondedAt: new Date(),
      },
      include: enquiryInclude,
    });
  }
}