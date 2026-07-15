import { SetMetadata } from '@nestjs/common';
import { RoleName } from '@shgap/database';

export const ROLES_KEY = 'roles';

/** Restricts a route to users holding at least one of the given roles (any district/ULB). */
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
