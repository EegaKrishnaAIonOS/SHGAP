import { Prisma } from '@shgap/database';
import { combineWhere, scopeConditions, toNumber } from './where-builder.util';

describe('scopeConditions', () => {
  it('returns no conditions for global scope', () => {
    const conditions = scopeConditions(
      { kind: 'global' },
      Prisma.sql`district_id`,
      Prisma.sql`ulb_id`,
    );
    expect(conditions).toHaveLength(0);
  });

  it('filters by district ids for district scope', () => {
    const conditions = scopeConditions(
      { kind: 'district', districtIds: ['d1', 'd2'] },
      Prisma.sql`district_id`,
      Prisma.sql`ulb_id`,
    );
    expect(conditions).toHaveLength(1);
    expect(conditions[0].strings.join('')).toContain('district_id');
    expect(conditions[0].values).toEqual([['d1', 'd2']]);
  });

  it('filters by ulb ids for ulb scope', () => {
    const conditions = scopeConditions(
      { kind: 'ulb', districtIds: ['d1'], ulbIds: ['u1', 'u2'] },
      Prisma.sql`district_id`,
      Prisma.sql`ulb_id`,
    );
    expect(conditions).toHaveLength(1);
    expect(conditions[0].strings.join('')).toContain('ulb_id');
    expect(conditions[0].values).toEqual([['u1', 'u2']]);
  });

  it('produces an always-false condition for self scope (should never be reached in practice)', () => {
    const conditions = scopeConditions(
      { kind: 'self', userId: 'u1' },
      Prisma.sql`district_id`,
      Prisma.sql`ulb_id`,
    );
    expect(conditions).toHaveLength(1);
    expect(conditions[0].strings.join('')).toBe('false');
  });
});

describe('combineWhere', () => {
  it('produces nothing for an empty condition list', () => {
    const result = combineWhere([]);
    expect(result.strings.join('').trim()).toBe('');
  });

  it('joins multiple conditions with AND, prefixed by WHERE', () => {
    const result = combineWhere([Prisma.sql`a = 1`, Prisma.sql`b = 2`]);
    const text = result.strings.join('?');
    expect(text).toContain('WHERE');
    expect(text).toContain('AND');
  });
});

describe('toNumber', () => {
  it('converts a numeric string (as Postgres returns bigint/numeric aggregates) to a number', () => {
    expect(toNumber('42')).toBe(42);
    expect(toNumber('3.14')).toBeCloseTo(3.14);
  });

  it('passes through a real number unchanged', () => {
    expect(toNumber(7)).toBe(7);
  });

  it('treats null/undefined as 0, not NaN', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });
});
