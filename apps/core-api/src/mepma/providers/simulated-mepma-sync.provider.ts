import { Injectable } from '@nestjs/common';
import {
  MepmaShgRecord,
  MepmaSyncProvider,
} from '../mepma-sync-provider.interface';

/**
 * No live MEPMA SHG-database API exists for this pilot to call (see
 * ADR-0030) — this stands in for one, the same way T13's console SMS
 * provider stands in for a real gateway (ADR-0022) and T14's Agmarknet
 * client is the one piece of this file's four integrations that IS real.
 * Swap this for a real HTTP-calling provider behind the same
 * `MepmaSyncProvider` interface once MEPMA grants API access — nothing
 * else in `MepmaSyncService` would need to change.
 *
 * Three records deliberately carry the exact `mepmaRegistrationNumber`
 * values the seed script (T02) already put on the platform's 3 real SHGs
 * (`MEPMA-ATP-0001`/`MEPMA-KRI-0002`/`MEPMA-VSP-0003` — confirmed directly
 * via `psql` before writing these, not guessed) so a sync run demonstrably
 * *links* real data via an exact-match hit, and two intentionally match
 * nothing — an honest stand-in for MEPMA-registered SHGs that haven't yet
 * onboarded a member to this platform.
 */
@Injectable()
export class SimulatedMepmaSyncProvider implements MepmaSyncProvider {
  async fetchShgRegistry(): Promise<MepmaShgRecord[]> {
    return [
      {
        mepmaRegistrationNumber: 'MEPMA-ATP-0001',
        name: 'Sri Lakshmi Pickles SHG',
        type: 'FOOD',
        districtName: 'Anantapur',
      },
      {
        mepmaRegistrationNumber: 'MEPMA-KRI-0002',
        name: 'Krishna Handloom Weavers SHG',
        type: 'HANDLOOM',
        districtName: 'Krishna',
      },
      {
        mepmaRegistrationNumber: 'MEPMA-VSP-0003',
        name: 'Vizag Bamboo Craft SHG',
        type: 'HANDICRAFTS',
        districtName: 'Visakhapatnam',
      },
      {
        mepmaRegistrationNumber: 'MEPMA-ATP-00389',
        name: 'Anantapur Millet Producers SHG',
        type: 'AGRICULTURE_ALLIED',
        districtName: 'Anantapur',
      },
      {
        mepmaRegistrationNumber: 'MEPMA-KRI-00256',
        name: 'Vijayawada Home Foods SHG',
        type: 'HOME_BASED_ENTERPRISE',
        districtName: 'Krishna',
      },
    ];
  }
}
