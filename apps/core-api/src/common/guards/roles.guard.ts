import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleName } from '@shgap/database';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtAccessPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      RoleName[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: JwtAccessPayload | undefined = request.user;

    const hasRole = user?.roleAssignments.some((ra) =>
      requiredRoles.includes(ra.role),
    );
    if (!hasRole) {
      throw new ForbiddenException('Insufficient role to access this resource');
    }
    return true;
  }
}
