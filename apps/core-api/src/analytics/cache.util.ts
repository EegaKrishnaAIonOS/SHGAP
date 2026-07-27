import { RedisService } from '../redis/redis.service';

/**
 * No generic cache wrapper exists anywhere in core-api yet (auth/otp call
 * raw ioredis get/set/incr directly) — this is analytics' own cache-aside
 * helper, written from scratch rather than adding a new dependency
 * (`@nestjs/cache-manager`) for what's a two-line pattern. See ADR-0027.
 *
 * `compute` only runs on a cache miss; a hit returns the stored JSON
 * unparsed-and-reparsed as-is, so callers get back exactly what they'd have
 * gotten from a fresh computation.
 */
export async function cacheAside<T>(
  redis: RedisService,
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const cached = await redis.get(key);
  if (cached !== null) {
    return JSON.parse(cached) as T;
  }

  const result = await compute();
  await redis.set(key, JSON.stringify(result), 'EX', ttlSeconds);
  return result;
}

/** Deterministic cache key from an endpoint name + its resolved filter
 * object — same filters always produce the same key regardless of
 * property insertion order (JSON.stringify does not sort keys itself). */
export function cacheKey(
  prefix: string,
  params: Record<string, unknown>,
): string {
  const sortedEntries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b));
  return `analytics:${prefix}:${JSON.stringify(sortedEntries)}`;
}
