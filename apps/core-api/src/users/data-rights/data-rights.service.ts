import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ConsentService } from '../../consent/consent.service';
import { PiiEncryptionService } from '../../security/pii-encryption.service';

export interface ErasureResult {
  status: 'completed';
  anonymizedFields: string[];
  retainedRecords: string[];
}

/**
 * Right-to-access and right-to-erasure (T22/ADR-0031, DPDP Act 2023).
 *
 * Access: a real, complete export of the calling user's own profile, owned
 * SHG (with bank details genuinely decrypted — this is *their own* data,
 * requested by them, not a third party), that SHG's products, and their
 * consent history.
 *
 * Erasure: anonymizes what belongs to the user directly (name, phone,
 * status) — it does not hard-delete the `User` row, because a real SHG
 * still references it via the required `Shg.contactUserId` FK, and it does
 * not touch that SHG's own sales/product records, which DPDP's legitimate-
 * business/legal-retention exceptions cover (an erased member's past real
 * transactions don't stop being real transactions). What's retained is
 * reported back explicitly, not silently kept without saying so.
 */
@Injectable()
export class DataRightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly consent: ConsentService,
    private readonly pii: PiiEncryptionService,
  ) {}

  async exportUserData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        shgs: {
          include: {
            district: true,
            ulb: true,
            mandal: true,
            products: { include: { category: true } },
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const shgs = await Promise.all(
      user.shgs.map(async (shg) => ({
        id: shg.id,
        name: shg.name,
        type: shg.type,
        mepmaRegistrationNumber: shg.mepmaRegistrationNumber,
        bankAccountNumber: await this.pii.decrypt(shg.bankAccountNumber),
        bankIfsc: await this.pii.decrypt(shg.bankIfsc),
        district: shg.district.name,
        ulb: shg.ulb?.name ?? null,
        mandal: shg.mandal?.name ?? null,
        products: shg.products.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category.name,
          price: Number(p.price),
          stock: p.stock,
        })),
      })),
    );

    const consents = await this.consent.listCurrent(userId);

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        preferredLanguage: user.preferredLanguage,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      },
      shgs,
      consents,
    };
  }

  async requestErasure(
    userId: string,
    ipAddress?: string,
  ): Promise<ErasureResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { shgs: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const before = {
      name: user.name,
      phone: user.phone,
      email: user.email,
      status: user.status,
    };
    // `phone` is VarChar(15) (a real caught-live bug: an earlier version of
    // this used a full UUID here and 500'd against that real column limit —
    // see ADR-0031) — 8 random hex characters keeps "erased-XXXXXXXX" at
    // exactly 15 characters while staying effectively unique at this
    // platform's real user count.
    const anonymizedPhone = `erased-${randomBytes(4).toString('hex')}`;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: null,
        email: null,
        phone: anonymizedPhone,
        status: 'ERASED',
      },
    });

    for (const status of await this.consent.listCurrent(userId)) {
      if (status.active) {
        await this.consent.withdraw(userId, status.purpose, ipAddress);
      }
    }

    await this.audit.record({
      actorUserId: userId,
      action: 'DATA_ERASURE_COMPLETED',
      entityType: 'User',
      entityId: userId,
      beforeState: before,
      afterState: {
        name: updated.name,
        phone: updated.phone,
        email: updated.email,
        status: updated.status,
      },
      ipAddress,
    });

    const retainedRecords: string[] = [];
    if (user.shgs.length > 0) {
      retainedRecords.push(
        `${user.shgs.length} SHG record(s) this account owns (registration, products, sales/enquiry history) — kept under DPDP's legitimate-business/legal-retention exception, not anonymized by this request`,
      );
    }

    return {
      status: 'completed',
      anonymizedFields: ['name', 'email', 'phone'],
      retainedRecords,
    };
  }
}
