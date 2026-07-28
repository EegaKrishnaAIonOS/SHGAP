import { MarketPricesService } from './market-prices.service';

describe('MarketPricesService', () => {
  let service: MarketPricesService;

  beforeEach(() => {
    const config = { getOrThrow: jest.fn().mockReturnValue('http://ml:8001') };
    service = new MarketPricesService(config as any);
    global.fetch = jest.fn();
  });

  it('maps ml-services price records from snake_case to camelCase', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        prices: [
          {
            state: 'Andhra Pradesh',
            district: 'Anantapur',
            market: 'Anantapur',
            commodity: 'Tomato',
            variety: 'Hybrid',
            arrival_date: '10/01/2026',
            min_price: 800,
            max_price: 1200,
            modal_price: 1000,
          },
        ],
      }),
    });

    const result = await service.getPrices({});

    expect(result).toEqual([
      {
        state: 'Andhra Pradesh',
        district: 'Anantapur',
        market: 'Anantapur',
        commodity: 'Tomato',
        variety: 'Hybrid',
        arrivalDate: '10/01/2026',
        minPrice: 800,
        maxPrice: 1200,
        modalPrice: 1000,
      },
    ]);
  });

  it('forwards district/commodity/limit as query params', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ prices: [] }),
    });

    await service.getPrices({
      district: 'Anantapur',
      commodity: 'Tomato',
      limit: 25,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://ml:8001/market-intelligence/prices?district=Anantapur&commodity=Tomato&limit=25',
    );
  });

  it('returns an empty list without throwing when ml-services is unreachable', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('ECONNREFUSED'),
    );

    await expect(service.getPrices({})).resolves.toEqual([]);
  });

  it('returns an empty list when ml-services responds with a non-OK status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(service.getPrices({})).resolves.toEqual([]);
  });
});
