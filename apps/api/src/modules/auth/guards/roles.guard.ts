import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@mirsonix/shared';
import type { AuthedRequest } from '../auth.types';
import { ROLES_KEY } from '../decorators/roles.decorator';

/** Runs after JwtAuthGuard. Routes without @Roles() are open to any authenticated user. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user || !required.includes(user.role)) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
