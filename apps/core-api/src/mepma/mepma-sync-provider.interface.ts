import { ShgType } from '@shgap/database';

export const MEPMA_SYNC_PROVIDER = Symbol('MEPMA_SYNC_PROVIDER');

/** One row as the (real or simulated) MEPMA SHG registry reports it —
 * identified only by fields an external government system would actually
 * have: no internal district/ULB UUIDs, since MEPMA has never heard of
 * this platform's own primary keys. */
export interface MepmaShgRecord {
  mepmaRegistrationNumber: string;
  name: string;
  type: ShgType;
  districtName: string;
}

export interface MepmaSyncProvider {
  fetchShgRegistry(): Promise<MepmaShgRecord[]>;
}
