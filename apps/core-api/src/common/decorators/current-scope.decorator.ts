import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestScope } from '../interfaces/jwt-payload.interface';

/** Reads the RequestScope computed by ScopeGuard onto `request.scope`. */
export const CurrentScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestScope => {
    const request = ctx.switchToHttp().getRequest();
    return request.scope;
  },
);
