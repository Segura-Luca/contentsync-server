import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_ACCESS_SECRET') ||
        'change_this_to_a_64_char_random_hex_secret_for_access_tokens_2026',
    });
  }

  async validate(payload: AuthenticatedUser): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: true,
        ownedAgency: true,
        clientProfile: true,
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Cuenta de usuario inactiva o suspendida.');
    }

    if (user.ownedAgency?.isSuspended) {
      throw new UnauthorizedException('La agencia asociada se encuentra suspendida.');
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role.code,
      agencyId: user.ownedAgency?.id ?? user.clientProfile?.agencyId ?? null,
      clientId: user.clientProfile?.id ?? null,
    };
  }
}
