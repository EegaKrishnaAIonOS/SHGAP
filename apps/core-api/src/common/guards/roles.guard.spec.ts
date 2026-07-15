import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function makeContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows the request when no roles are required', () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ roleAssignments: [] }))).toBe(true);
  });

  it('allows the request when the user holds one of the required roles', () => {
    const reflector = {
      getAllAndOverride: () => ['ADMIN', 'STATE_OFFICIAL'],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const user = { roleAssignments: [{ role: 'ADMIN' }] };
    expect(guard.canActivate(makeContext(user))).toBe(true);
  });

  it('rejects the request when the user holds none of the required roles', () => {
    const reflector = {
      getAllAndOverride: () => ['ADMIN'],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const user = { roleAssignments: [{ role: 'SHG' }] };
    expect(() => guard.canActivate(makeContext(user))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects when there is no user on the request at all', () => {
    const reflector = {
      getAllAndOverride: () => ['ADMIN'],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
