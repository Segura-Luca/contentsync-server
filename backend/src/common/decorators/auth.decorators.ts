/** Decoradores de seguridad que se usan en los controladores: @Public(), @Roles() y @CurrentUser(). */
import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { RoleCode } from '@prisma/client';

/** Usuario autenticado disponible durante la petición. `sub` es su id; lo completa JwtStrategy. */
export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: RoleCode;
  timezone?: string;
  agencyId?: string | null;
  clientId?: string | null;
  hasPassword?: boolean;
}

export const IS_PUBLIC_KEY = 'isPublic';
/** @Public(): la ruta no exige iniciar sesión (JwtAuthGuard la deja pasar). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** @Roles(...): solo los roles indicados pueden usar la ruta (lo comprueba RolesGuard). */
export const Roles = (...roles: RoleCode[]) => SetMetadata(ROLES_KEY, roles);

/** @CurrentUser(): entrega al método el usuario de la petición, o solo uno de sus campos: @CurrentUser("email"). */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    return data ? user?.[data] : user;
  },
);
