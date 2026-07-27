import { Prisma } from '@shgap/database';
import { RequestScope } from '../common/interfaces/jwt-payload.interface';

/**
 * The caller's RBAC scope, expressed as raw-SQL conditions against whichever
 * district/ULB columns the caller names — `mv_sales_facts`/`mv_enquiry_facts`/
 * `mv_recommendation_facts` all expose bare `district_id`/`ulb_id`, while a
 * query starting from the `shg`/`products` tables needs `shg.district_id`/
 * `shg.ulb_id` instead, hence the column fragments being parameters here
 * rather than hardcoded.
 *
 * `scope.kind === 'self'` can't actually reach analytics endpoints in
 * practice (they're RolesGuard-restricted to ADMIN/STATE_OFFICIAL/
 * DISTRICT_OFFICIAL/ULB_OFFICIAL, none of which ScopeGuard ever resolves to
 * 'self' — see scope.guard.ts) — `false` is a safe, inert fallback if that
 * invariant is ever violated, rather than silently returning unscoped data.
 */
export function scopeConditions(
  scope: RequestScope,
  districtColumn: Prisma.Sql,
  ulbColumn: Prisma.Sql,
): Prisma.Sql[] {
  switch (scope.kind) {
    case 'global':
      return [];
    case 'district':
      return [
        Prisma.sql`${districtColumn} = ANY(${scope.districtIds}::uuid[])`,
      ];
    case 'ulb':
      return [Prisma.sql`${ulbColumn} = ANY(${scope.ulbIds}::uuid[])`];
    case 'self':
      return [Prisma.sql`false`];
  }
}

/** Combines a list of conditions into `WHERE a AND b AND c`, or nothing at
 * all when the list is empty — never emits a dangling `WHERE`. */
export function combineWhere(conditions: Prisma.Sql[]): Prisma.Sql {
  return conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;
}

/** Postgres returns bigint/numeric aggregates (COUNT/SUM) as strings to
 * avoid silent precision loss in the driver — convert back to a plain JS
 * number for a JSON API response, where JS's own float precision is exactly
 * what every other numeric field in this API already uses. */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}
