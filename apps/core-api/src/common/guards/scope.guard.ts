import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { RequestScope } from '../interfaces/jwt-payload.interface';

/**
 * Computes the RequestScope for the authenticated user and attaches it to
 * `request.scope`, so controllers/services can filter district/ULB officials
 * down to their own data without re-deriving role logic everywhere.
 *
 * Precedence: ADMIN/STATE_OFFICIAL see everything; DISTRICT_OFFICIAL is scoped
 * to their district(s); ULB_OFFICIAL to their ULB(s) (+ parent district(s));
 * everyone else (SHG members, or a user with no official role) is scoped to
 * their own user id only.
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    request.scope = ScopeGuard.computeScope(
      user?.sub,
      user?.roleAssignments ?? [],
    );
    return true;
  }

  static computeScope(
    userId: string | undefined,
    roleAssignments: Array<{
      role: string;
      districtId?: string;
      ulbId?: string;
    }>,
  ): RequestScope {
    if (
      roleAssignments.some(
        (ra) => ra.role === 'ADMIN' || ra.role === 'STATE_OFFICIAL',
      )
    ) {
      return { kind: 'global' };
    }

    const ulbAssignments = roleAssignments.filter(
      (ra) => ra.role === 'ULB_OFFICIAL' && ra.ulbId,
    );
    if (ulbAssignments.length > 0) {
      return {
        kind: 'ulb',
        ulbIds: ulbAssignments.map((ra) => ra.ulbId!),
        districtIds: [
          ...new Set(ulbAssignments.map((ra) => ra.districtId).filter(Boolean)),
        ] as string[],
      };
    }

    const districtAssignments = roleAssignments.filter(
      (ra) => ra.role === 'DISTRICT_OFFICIAL' && ra.districtId,
    );
    if (districtAssignments.length > 0) {
      return {
        kind: 'district',
        districtIds: districtAssignments.map((ra) => ra.districtId!),
      };
    }

    return { kind: 'self', userId: userId ?? '' };
  }
}
