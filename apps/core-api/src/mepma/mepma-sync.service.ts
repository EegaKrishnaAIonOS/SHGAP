import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  MEPMA_SYNC_PROVIDER,
  MepmaShgRecord,
  MepmaSyncProvider,
} from './mepma-sync-provider.interface';

export interface MepmaSyncResult {
  totalFromRegistry: number;
  linkedExisting: number;
  backfilledRegistrationNumber: number;
  /** Real MEPMA-registered SHGs with no matching platform account yet —
   * reported honestly, never fabricated into a phantom `Shg` row (which
   * would need a real `contactUserId` this sync has no way to supply). */
  unmatched: MepmaShgRecord[];
}

@Injectable()
export class MepmaSyncService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEPMA_SYNC_PROVIDER) private readonly provider: MepmaSyncProvider,
  ) {}

  /**
   * Identity-mapping + dedupe against the platform's real `Shg` table
   * (T21): every record from the registry is matched by, in order,
   * (1) an exact `mepmaRegistrationNumber` already on file — nothing to
   * do beyond confirming the link, and (2) same name + district for an
   * SHG that self-registered through the app before ever being MEPMA-
   * synced — back-filling its registration number is the real "dedupe"
   * case. Anything left over genuinely has no platform account yet.
   */
  async syncShgRegistry(): Promise<MepmaSyncResult> {
    const records = await this.provider.fetchShgRegistry();
    let linkedExisting = 0;
    let backfilledRegistrationNumber = 0;
    const unmatched: MepmaShgRecord[] = [];

    for (const record of records) {
      const byRegistrationNumber = await this.prisma.shg.findUnique({
        where: { mepmaRegistrationNumber: record.mepmaRegistrationNumber },
      });
      if (byRegistrationNumber) {
        linkedExisting++;
        continue;
      }

      const district = await this.prisma.district.findUnique({
        where: { name: record.districtName },
      });
      const byNameAndDistrict = district
        ? await this.prisma.shg.findFirst({
            where: {
              name: { equals: record.name, mode: 'insensitive' },
              districtId: district.id,
              mepmaRegistrationNumber: null,
            },
          })
        : null;

      if (byNameAndDistrict) {
        await this.prisma.shg.update({
          where: { id: byNameAndDistrict.id },
          data: { mepmaRegistrationNumber: record.mepmaRegistrationNumber },
        });
        backfilledRegistrationNumber++;
        continue;
      }

      unmatched.push(record);
    }

    return {
      totalFromRegistry: records.length,
      linkedExisting,
      backfilledRegistrationNumber,
      unmatched,
    };
  }
}
