import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AUDIT_ENTITY_TYPE_KEY } from './audited.decorator';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Global (registered once via `APP_INTERCEPTOR`), but a no-op for every
 * route that isn't explicitly `@Audited(...)` — mirrors `@Public()`'s
 * opt-in shape rather than trying to auto-derive an entity id/state from
 * every possible response shape in the app. Records *after* the handler
 * succeeds (so a failed request never gets logged as if it happened), and
 * a recording failure of its own is caught and logged, never allowed to
 * turn a real, successful request into a 500.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const entityType = this.reflector.get<string>(
      AUDIT_ENTITY_TYPE_KEY,
      context.getHandler(),
    );
    if (!entityType) return next.handle();

    const request = context.switchToHttp().getRequest();
    const actorUserId: string | null = request.user?.sub ?? null;
    const ipAddress: string | null = request.ip ?? null;
    const method: string = request.method;
    const paramId: string | undefined = request.params?.id;
    const action = `${method} ${request.route?.path ?? request.url}`;

    return next.handle().pipe(
      tap((responseBody) => {
        const entityId = paramId ?? responseBody?.id;
        if (typeof entityId !== 'string' || !UUID_PATTERN.test(entityId)) {
          this.logger.warn(
            `Skipping audit record for ${action} — no valid entity id (param or response body)`,
          );
          return;
        }
        this.auditService
          .record({
            actorUserId,
            action,
            entityType,
            entityId,
            afterState: method === 'DELETE' ? undefined : responseBody,
            ipAddress,
          })
          .catch((err) => {
            this.logger.error(
              `Failed to write audit record for ${action}: ${(err as Error).message}`,
            );
          });
      }),
    );
  }
}
