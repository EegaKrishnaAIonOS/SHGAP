import { GeoService } from './geo.service';

describe('GeoService', () => {
  let prisma: { $executeRaw: jest.Mock; $queryRaw: jest.Mock };
  let service: GeoService;

  beforeEach(() => {
    prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    service = new GeoService(prisma as any);
  });

  it('setLocation issues a raw UPDATE with ST_MakePoint', async () => {
    await service.setLocation('shg', 'shg-1', { lat: 14.68, lng: 77.6 });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('getLocation returns null when the row has no location set', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    const result = await service.getLocation('shg', 'shg-1');
    expect(result).toBeNull();
  });

  it('getLocation returns the lat/lng when present', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ lat: 14.68, lng: 77.6 }]);
    const result = await service.getLocation('shg', 'shg-1');
    expect(result).toEqual({ lat: 14.68, lng: 77.6 });
  });

  it('findNearbyIds returns ids with distances, nearest first per the query ordering', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      { id: 'p1', distanceKm: 2.5 },
      { id: 'p2', distanceKm: 10 },
    ]);
    const result = await service.findNearbyIds(
      'products',
      { lat: 14.68, lng: 77.6 },
      25,
    );
    expect(result).toEqual([
      { id: 'p1', distanceKm: 2.5 },
      { id: 'p2', distanceKm: 10 },
    ]);
  });
});
