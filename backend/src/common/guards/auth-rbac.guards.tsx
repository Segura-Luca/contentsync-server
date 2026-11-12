/**
 * Guards globales: deciden si una petición puede llegar al controlador.
 * JwtAuthGuard comprueba QUIÉN es el usuario; RolesGuard comprueba QUÉ puede hacer.
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { RoleCode } from '@prisma/client';
import { IS_PUBLIC_KEY, ROLES_KEY, AuthenticatedUser } from '../decorators/auth.decorators';

/** Exige un token JWT válido en todas las rutas, salvo las marcadas con @Public(). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /** Si la ruta es pública la deja pasar; si no, delega la validación del token en JwtStrategy. */
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  /** Recibe el resultado de la validación: sin usuario válido responde 401. */
  handleRequest<TUser = AuthenticatedUser>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Token JWT inválido, ausente o expirado.');
    }
    return user;
  }
}

/** Comprueba que el rol del usuario esté entre los exigidos por @Roles(). Sin @Roles(), cualquier usuario autenticado pasa. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleCode[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) {
      throw new UnauthorizedException('Usuario no autenticado.');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Acceso denegado: se requiere uno de los roles [${requiredRoles.join(', ')}] y tu rol actual es ${user.role}.`,
      );
    }

    return true;
  }
}
