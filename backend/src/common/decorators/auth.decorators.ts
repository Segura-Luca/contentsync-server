import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { RoleCode } from '@prisma/client';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: RoleCode;
  agencyId?: string | null;
  clientId?: string | null;
}

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RoleCode[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    return data ? user?.[data] : user;
  },
);
