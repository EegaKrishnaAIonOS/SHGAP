import { Injectable } from '@nestjs/common';
import { ConsentPurpose } from '@shgap/database';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CONSENT_PURPOSES } from './dto/grant-consent.dto';
import { PRIVACY_NOTICES } from './privacy-notices';

export interface ConsentStatus {
  purpose: ConsentPurpose;
  active: boolean;
  version: string | null;
  grantedAt: string | null;
  withdrawnAt: string | null;
  notice: { version: string; title: string; text: string };
}

/**
 * Consent capture/withdrawal (T22/ADR-0031, DPDP Act 2023). Every grant and
 * withdrawal is a new, append-only `Consent` row — never an update-in-place
 * — so a person's consent history for a purpose (grant → withdraw →
 * re-grant) stays fully reconstructable, and each row is separately
 * recorded in the tamper-evident audit trail.
 */
@Injectable()
export class ConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async grant(
    userId: string,
    purpose: ConsentPurpose,
    ipAddress?: string,
  ): Promise<ConsentStatus> {
    const notice = PRIVACY_NOTICES[purpose];
    const consent = await this.prisma.consent.create({
      data: { userId, purpose, granted: true, version: notice.version },
    });

    await this.audit.record({
      actorUserId: userId,
      action: 'CONSENT_GRANTED',
      entityType: 'Consent',
      entityId: consent.id,
      afterState: { purpose, version: notice.version },
      ipAddress,
    });

    return this.toStatus(purpose, consent);
  }

  async withdraw(
    userId: string,
    purpose: ConsentPurpose,
    ipAddress?: string,
  ): Promise<ConsentStatus> {
    const latest = await this.latestFor(userId, purpose);

    // Withdrawal must be as easy as consent (DPDP) — withdrawing a purpose
    // that was never granted, or already withdrawn, is a harmless no-op,
    // not an error a caller needs to work around.
    if (!latest || !latest.granted || latest.withdrawnAt) {
      return this.toStatus(purpose, latest);
    }

    const withdrawn = await this.prisma.consent.update({
      where: { id: latest.id },
      data: { withdrawnAt: new Date() },
    });

    await this.audit.record({
      actorUserId: userId,
      action: 'CONSENT_WITHDRAWN',
      entityType: 'Consent',
      entityId: withdrawn.id,
      beforeState: { withdrawnAt: null },
      afterState: { withdrawnAt: withdrawn.withdrawnAt?.toISOString() },
      ipAddress,
    });

    return this.toStatus(purpose, withdrawn);
  }

  async listCurrent(userId: string): Promise<ConsentStatus[]> {
    return Promise.all(
      CONSENT_PURPOSES.map(async (purpose) =>
        this.toStatus(purpose, await this.latestFor(userId, purpose)),
      ),
    );
  }

  /** Real enforcement hook for downstream flows (e.g. T21's GeM
   * tender-opportunity alerts) — active means granted and not withdrawn. */
  async hasActiveConsent(
    userId: string,
    purpose: ConsentPurpose,
  ): Promise<boolean> {
    const latest = await this.latestFor(userId, purpose);
    return Boolean(latest && latest.granted && !latest.withdrawnAt);
  }

  private async latestFor(userId: string, purpose: ConsentPurpose) {
    return this.prisma.consent.findFirst({
      where: { userId, purpose },
      orderBy: { grantedAt: 'desc' },
    });
  }

  private toStatus(
    purpose: ConsentPurpose,
    consent: {
      granted: boolean;
      version: string;
      grantedAt: Date;
      withdrawnAt: Date | null;
    } | null,
  ): ConsentStatus {
    return {
      purpose,
      active: Boolean(consent && consent.granted && !consent.withdrawnAt),
      version: consent?.version ?? null,
      grantedAt: consent?.grantedAt.toISOString() ?? null,
      withdrawnAt: consent?.withdrawnAt?.toISOString() ?? null,
      notice: PRIVACY_NOTICES[purpose],
    };
  }
}
