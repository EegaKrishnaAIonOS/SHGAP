import { RoleName } from '@shgap/database';

export interface RoleAssignment {
  role: RoleName;
  districtId?: string;
  ulbId?: string;
}

/** Access-token claims. Refresh tokens use RefreshTokenPayload instead. */
export interface JwtAccessPayload {
  sub: string;
  phone: string;
  roleAssignments: RoleAssignment[];
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

/** Computed per-request from the authenticated user's role assignments — narrows
 * which district/ULB/own-only data a controller should query. */
export type RequestScope =
  | { kind: 'global' }
  | { kind: 'district'; districtIds: string[] }
  | { kind: 'ulb'; districtIds: string[]; ulbIds: string[] }
  | { kind: 'self'; userId: string };
