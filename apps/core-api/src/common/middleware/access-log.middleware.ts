import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Generic HTTP access logging (T22/ADR-0031) — every request, not just the
 * ones `AuditInterceptor` deliberately records. Distinct purpose from the
 * audit trail: this is "who hit which endpoint, when, how fast, what
 * status" for operational/security review, not a tamper-evident record of
 * a specific business mutation.
 */
@Injectable()
export class AccessLogMiddleware implements NestMiddleware {
  private readonly logger = new Logger('AccessLog');

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const actorUserId =
        (req as unknown as { user?: { sub?: string } }).user?.sub ?? null;
      this.logger.log(
        JSON.stringify({
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Math.round(durationMs),
          ip: req.ip,
          actorUserId,
        }),
      );
    });
    next();
  }
}
