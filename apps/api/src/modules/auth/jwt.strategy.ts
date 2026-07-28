import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../../common/config/env';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

export interface JwtPayload {
  sub: string;
  email: string;
  orgId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  /**
   * Re-reads membership on every request so a revoked user or a role change
   * takes effect immediately rather than at token expiry.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId: payload.sub, organizationId: payload.orgId },
      include: { user: true },
    });

    if (!membership) {
      throw new UnauthorizedException('Membership no longer valid');
    }

    return {
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.user.role,
      organizationId: membership.organizationId,
      orgRole: membership.role,
    };
  }
}
