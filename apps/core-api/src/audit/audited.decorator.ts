import { SetMetadata } from '@nestjs/common';

export const AUDIT_ENTITY_TYPE_KEY = 'auditEntityType';

/** Marks a mutating route as one `AuditInterceptor` should record — explicit
 * per-route, matching this codebase's `@Roles(...)`/`@Public()` convention,
 * rather than a global interceptor guessing at every route's entity shape. */
export const Audited = (entityType: string) =>
  SetMetadata(AUDIT_ENTITY_TYPE_KEY, entityType);
