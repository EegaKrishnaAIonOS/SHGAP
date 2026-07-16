import { ReverseGeocodeService } from './reverse-geocode.service';

describe('ReverseGeocodeService', () => {
  let prisma: { district: { findMany: jest.Mock } };
  let service: ReverseGeocodeService;
  const districts = [
    { id: 'd-atp', name: 'Anantapur' },
    { id: 'd-kri', name: 'Krishna' },
    { id: 'd-vsp', name: 'Visakhapatnam' },
  ];

  beforeEach(() => {
    prisma = { district: { findMany: jest.fn().mockResolvedValue(districts) } };
    service = new ReverseGeocodeService(prisma as any);
    global.fetch = jest.fn();
  });

  it('matches a Nominatim state_district against a seeded pilot district', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        address: {
          state_district: 'Anantapur District',
          state: 'Andhra Pradesh',
        },
      }),
    });

    const result = await service.reverse({ lat: 14.68, lng: 77.6 });

    expect(result.suggestedDistrictId).toBe('d-atp');
    expect(result.suggestedDistrictName).toBe('Anantapur');
    expect(result.matchedAddressField).toBe('state_district');
  });

  it('returns nulls when the point is outside all pilot districts', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        address: { state_district: 'Chennai', state: 'Tamil Nadu' },
      }),
    });

    const result = await service.reverse({ lat: 13.08, lng: 80.27 });

    expect(result.suggestedDistrictId).toBeNull();
    expect(result.rawAddress.state_district).toBe('Chennai');
  });

  it('returns nulls without throwing when Nominatim is unreachable', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('network down'),
    );

    const result = await service.reverse({ lat: 14.68, lng: 77.6 });

    expect(result.suggestedDistrictId).toBeNull();
    expect(result.rawAddress).toEqual({});
  });

  it('returns nulls when Nominatim responds with a non-OK status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    const result = await service.reverse({ lat: 14.68, lng: 77.6 });

    expect(result.suggestedDistrictId).toBeNull();
  });
});
