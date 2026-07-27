import { cacheAside, cacheKey } from './cache.util';

describe('cacheAside', () => {
  let redis: { get: jest.Mock; set: jest.Mock };

  beforeEach(() => {
    redis = { get: jest.fn(), set: jest.fn() };
  });

  it('returns the cached value without calling compute on a hit', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ value: 42 }));
    const compute = jest.fn();

    const result = await cacheAside(redis as any, 'k', 60, compute);

    expect(result).toEqual({ value: 42 });
    expect(compute).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('calls compute and stores the result on a miss', async () => {
    redis.get.mockResolvedValue(null);
    const compute = jest.fn().mockResolvedValue({ value: 7 });

    const result = await cacheAside(redis as any, 'k', 60, compute);

    expect(result).toEqual({ value: 7 });
    expect(redis.set).toHaveBeenCalledWith(
      'k',
      JSON.stringify({ value: 7 }),
      'EX',
      60,
    );
  });
});

describe('cacheKey', () => {
  it('produces the same key regardless of property insertion order', () => {
    const a = cacheKey('prefix', { b: 2, a: 1 });
    const b = cacheKey('prefix', { a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it('produces different keys for different parameter values', () => {
    const a = cacheKey('prefix', { districtId: 'd1' });
    const b = cacheKey('prefix', { districtId: 'd2' });
    expect(a).not.toBe(b);
  });

  it('ignores undefined/null values so an omitted filter does not change the key', () => {
    const a = cacheKey('prefix', { districtId: undefined, ulbId: null });
    const b = cacheKey('prefix', {});
    expect(a).toBe(b);
  });
});
