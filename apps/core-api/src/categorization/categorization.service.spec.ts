import { CategorizationService } from './categorization.service';

describe('CategorizationService', () => {
  let service: CategorizationService;

  beforeEach(() => {
    const config = { getOrThrow: jest.fn().mockReturnValue('http://ml:8001') };
    service = new CategorizationService(config as any);
    global.fetch = jest.fn();
  });

  it('maps ml-services suggestions from snake_case to camelCase', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            category_id: 'cat-1',
            category_name: 'Pickles',
            parent_category_name: 'Food Products',
            score: 0.52,
          },
        ],
      }),
    });

    const result = await service.suggest('Mango Pickle', 'Spicy and tangy');

    expect(result).toEqual([
      {
        categoryId: 'cat-1',
        categoryName: 'Pickles',
        parentCategoryName: 'Food Products',
        score: 0.52,
      },
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://ml:8001/categorize',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Mango Pickle',
          description: 'Spicy and tangy',
        }),
      }),
    );
  });

  it('sends null description when none is given', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ suggestions: [] }),
    });

    await service.suggest('Bamboo Basket', undefined);

    expect(global.fetch).toHaveBeenCalledWith(
      'http://ml:8001/categorize',
      expect.objectContaining({
        body: JSON.stringify({ name: 'Bamboo Basket', description: null }),
      }),
    );
  });

  it('returns an empty list without throwing when ml-services is unreachable', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('ECONNREFUSED'),
    );

    const result = await service.suggest('Mango Pickle', undefined);

    expect(result).toEqual([]);
  });

  it('returns an empty list when ml-services responds with a non-OK status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await service.suggest('Mango Pickle', undefined);

    expect(result).toEqual([]);
  });
});
