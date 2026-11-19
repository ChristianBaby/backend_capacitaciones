import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';

@Roles('ADMIN')
class AdminOnly {
  handler() {}
}
class Open {
  handler() {}
}

function ctx(cls: any, user?: { role: string }): ExecutionContext {
  return {
    getHandler: () => cls.prototype.handler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('allows a user whose role is listed', () => {
    expect(guard.canActivate(ctx(AdminOnly, { role: 'ADMIN' }))).toBe(true);
  });

  it.each(['INSTRUCTOR', 'STUDENT'])('forbids role %s on an ADMIN route', (role) => {
    expect(() => guard.canActivate(ctx(AdminOnly, { role }))).toThrow(ForbiddenException);
  });

  it('forbids when there is no user on the request', () => {
    expect(() => guard.canActivate(ctx(AdminOnly))).toThrow(ForbiddenException);
  });

  it('allows any user on a route without @Roles', () => {
    expect(guard.canActivate(ctx(Open, { role: 'STUDENT' }))).toBe(true);
  });
});
