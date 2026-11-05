import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtAccessSecret,
    });
  }

  async validate(payload: AuthenticatedUser): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: true,
        ownedAgency: true,
        clientProfile: { include: { agency: { select: { isSuspended: true } } } },
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Cuenta de usuario inactiva o suspendida.');
    }

    if (user.ownedAgency?.isSuspended || user.clientProfile?.agency?.isSuspended) {
      throw new UnauthorizedException('La agencia asociada se encuentra suspendida.');
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role.code,
      timezone: user.timezone,
      agencyId: user.ownedAgency?.id ?? user.clientProfile?.agencyId ?? null,
      clientId: user.clientProfile?.id ?? null,
    };
  }
}
