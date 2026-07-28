import { MepmaSyncService } from './mepma-sync.service';
import { MepmaSyncProvider } from './mepma-sync-provider.interface';

describe('MepmaSyncService', () => {
  let prisma: any;
  let provider: { fetchShgRegistry: jest.Mock };
  let service: MepmaSyncService;

  beforeEach(() => {
    prisma = {
      shg: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      district: {
        findUnique: jest.fn(),
      },
    };
    provider = { fetchShgRegistry: jest.fn() };
    service = new MepmaSyncService(prisma, provider as MepmaSyncProvider);
  });

  const record = {
    mepmaRegistrationNumber: 'MEPMA-ATP-00231',
    name: 'Sri Lakshmi Pickles SHG',
    type: 'FOOD' as const,
    districtName: 'Anantapur',
  };

  it('counts an SHG already linked by registration number as linkedExisting, not backfilled', async () => {
    provider.fetchShgRegistry.mockResolvedValue([record]);
    prisma.shg.findUnique.mockResolvedValue({ id: 'shg-1', ...record });

    const result = await service.syncShgRegistry();

    expect(result).toEqual({
      totalFromRegistry: 1,
      linkedExisting: 1,
      backfilledRegistrationNumber: 0,
      unmatched: [],
    });
    expect(prisma.shg.update).not.toHaveBeenCalled();
  });

  it('backfills the registration number onto a matching name+district SHG that has none yet', async () => {
    provider.fetchShgRegistry.mockResolvedValue([record]);
    prisma.shg.findUnique.mockResolvedValue(null);
    prisma.district.findUnique.mockResolvedValue({
      id: 'district-1',
      name: 'Anantapur',
    });
    prisma.shg.findFirst.mockResolvedValue({
      id: 'shg-1',
      mepmaRegistrationNumber: null,
    });

    const result = await service.syncShgRegistry();

    expect(result.backfilledRegistrationNumber).toBe(1);
    expect(result.linkedExisting).toBe(0);
    expect(result.unmatched).toEqual([]);
    expect(prisma.shg.update).toHaveBeenCalledWith({
      where: { id: 'shg-1' },
      data: { mepmaRegistrationNumber: 'MEPMA-ATP-00231' },
    });
  });

  it('reports a registry record with no matching platform SHG as unmatched, never fabricating a new SHG row', async () => {
    provider.fetchShgRegistry.mockResolvedValue([record]);
    prisma.shg.findUnique.mockResolvedValue(null);
    prisma.district.findUnique.mockResolvedValue({
      id: 'district-1',
      name: 'Anantapur',
    });
    prisma.shg.findFirst.mockResolvedValue(null);

    const result = await service.syncShgRegistry();

    expect(result.unmatched).toEqual([record]);
    expect(result.linkedExisting).toBe(0);
    expect(result.backfilledRegistrationNumber).toBe(0);
    expect(prisma.shg.update).not.toHaveBeenCalled();
  });

  it('treats an unknown district name as no match rather than throwing', async () => {
    provider.fetchShgRegistry.mockResolvedValue([record]);
    prisma.shg.findUnique.mockResolvedValue(null);
    prisma.district.findUnique.mockResolvedValue(null);

    const result = await service.syncShgRegistry();

    expect(result.unmatched).toEqual([record]);
    expect(prisma.shg.findFirst).not.toHaveBeenCalled();
  });
});
