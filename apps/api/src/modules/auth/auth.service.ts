import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuthProvider, type User } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { Env } from '../../common/config/env';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from './jwt.strategy';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthResult extends AuthTokens {
  user: { id: string; email: string; name: string; avatarUrl: string | null };
  organization: { id: string; name: string; slug: string; credits: number };
}

const SIGNUP_CREDIT_GRANT = 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async register(args: {
    email: string;
    password: string;
    name: string;
    organizationName?: string;
  }): Promise<AuthResult> {
    const email = args.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const passwordHash = await argon2.hash(args.password, { type: argon2.argon2id });
    const orgName = args.organizationName?.trim() || `${args.name}'s Workspace`;

    const { user, organization } = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: { email, name: args.name.trim(), passwordHash },
      });

      const createdOrg = await tx.organization.create({
        data: {
          name: orgName,
          slug: await this.uniqueSlug(orgName),
          credits: SIGNUP_CREDIT_GRANT,
        },
      });

      await tx.membership.create({
        data: { userId: createdUser.id, organizationId: createdOrg.id, role: 'OWNER' },
      });

      await tx.creditTransaction.create({
        data: {
          organizationId: createdOrg.id,
          amount: SIGNUP_CREDIT_GRANT,
          balanceAfter: SIGNUP_CREDIT_GRANT,
          reason: 'SIGNUP_GRANT',
          description: 'Welcome credits',
        },
      });

      // A default brand kit means the first pipeline run already has brand context.
      await tx.brandKit.create({
        data: { organizationId: createdOrg.id, name: 'Default Brand Kit', isDefault: true },
      });

      return { user: createdUser, organization: createdOrg };
    });

    return this.issue(user, organization.id);
  }

  async login(email: string, password: string, meta?: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Verify against a dummy hash when the user is missing so response timing
    // does not reveal whether an account exists.
    const hash = user?.passwordHash ?? DUMMY_HASH;
    const valid = await argon2.verify(hash, password).catch(() => false);

    if (!user || !user.passwordHash || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const membership = await this.primaryMembership(user.id);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issue(user, membership.organizationId, meta);
  }

  /** Shared entry point for Google and GitHub callbacks. */
  async oauthLogin(args: {
    provider: OAuthProvider;
    providerAccountId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }): Promise<AuthResult> {
    const email = args.email.toLowerCase().trim();

    const existingAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: args.provider,
          providerAccountId: args.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (existingAccount) {
      const membership = await this.primaryMembership(existingAccount.userId);
      return this.issue(existingAccount.user, membership.organizationId);
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      // Link the provider to the account that already owns this verified email.
      await this.prisma.oAuthAccount.create({
        data: {
          provider: args.provider,
          providerAccountId: args.providerAccountId,
          userId: existingUser.id,
        },
      });
      const membership = await this.primaryMembership(existingUser.id);
      return this.issue(existingUser, membership.organizationId);
    }

    const orgName = `${args.name}'s Workspace`;
    const { user, organization } = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          name: args.name,
          avatarUrl: args.avatarUrl,
          emailVerified: true,
          oauthAccounts: {
            create: {
              provider: args.provider,
              providerAccountId: args.providerAccountId,
            },
          },
        },
      });
      const createdOrg = await tx.organization.create({
        data: {
          name: orgName,
          slug: await this.uniqueSlug(orgName),
          credits: SIGNUP_CREDIT_GRANT,
        },
      });
      await tx.membership.create({
        data: { userId: createdUser.id, organizationId: createdOrg.id, role: 'OWNER' },
      });
      await tx.creditTransaction.create({
        data: {
          organizationId: createdOrg.id,
          amount: SIGNUP_CREDIT_GRANT,
          balanceAfter: SIGNUP_CREDIT_GRANT,
          reason: 'SIGNUP_GRANT',
        },
      });
      await tx.brandKit.create({
        data: { organizationId: createdOrg.id, name: 'Default Brand Kit', isDefault: true },
      });
      return { user: createdUser, organization: createdOrg };
    });

    return this.issue(user, organization.id);
  }

  /** Rotates the refresh token: the presented one is revoked as it is consumed. */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.mintTokens(stored.user, payload.orgId);
    await this.persistRefreshToken(stored.userId, tokens.refreshToken);
    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string, organizationId: string) {
    const membership = await this.prisma.membership.findFirstOrThrow({
      where: { userId, organizationId },
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true, role: true } },
        organization: {
          select: { id: true, name: true, slug: true, plan: true, credits: true },
        },
      },
    });
    return {
      user: membership.user,
      organization: membership.organization,
      orgRole: membership.role,
    };
  }

  private async primaryMembership(userId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership) throw new UnauthorizedException('User has no organization membership');
    return membership;
  }

  private async issue(
    user: User,
    organizationId: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<AuthResult> {
    const tokens = await this.mintTokens(user, organizationId);
    await this.persistRefreshToken(user.id, tokens.refreshToken, meta);

    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true, credits: true },
    });

    return {
      ...tokens,
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
      organization,
    };
  }

  private async mintTokens(user: User, organizationId: string): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: user.id, email: user.email, orgId: organizationId };
    const expiresIn = this.config.get('JWT_ACCESS_TTL', { infer: true });

    // jsonwebtoken types `expiresIn` as a template-literal union; the value is
    // validated as a duration string by config, so widen it here.
    const accessTtl = expiresIn as unknown as number;
    const refreshTtl = `${this.config.get('JWT_REFRESH_TTL_DAYS', { infer: true })}d` as unknown as number;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: accessTtl,
      }),
      this.jwt.signAsync(
        { ...payload, jti: randomBytes(16).toString('hex') },
        {
          secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
          expiresIn: refreshTtl,
        },
      ),
    ]);

    return { accessToken, refreshToken, expiresIn };
  }

  private async persistRefreshToken(
    userId: string,
    refreshToken: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<void> {
    const days = this.config.get('JWT_REFRESH_TTL_DAYS', { infer: true });
    const expiresAt = new Date(Date.now() + days * 86_400_000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(refreshToken),
        expiresAt,
        ip: meta?.ip,
        userAgent: meta?.userAgent?.slice(0, 500),
      },
    });
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'workspace';

    for (let i = 0; i < 100; i++) {
      const candidate = i === 0 ? base : `${base}-${i}`;
      const taken = await this.prisma.organization.findUnique({ where: { slug: candidate } });
      if (!taken) return candidate;
    }
    return `${base}-${randomBytes(4).toString('hex')}`;
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Argon2id hash of a random constant, used purely for timing equalisation. */
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHR2YWx1ZQ$FqZP3Xk8vJ1cH0oL9wQ7bYxNmR4tS2uV6aI5eK8dGnA';
