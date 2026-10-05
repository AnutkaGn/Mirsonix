import type { UserRole } from '@mirsonix/shared';
import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

export interface AuthedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface RequestMeta {
  userAgent: string | null;
  ip: string | null;
}
