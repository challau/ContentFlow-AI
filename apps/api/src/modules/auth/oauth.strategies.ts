import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as GoogleStrategy, type Profile as GoogleProfile } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy, type Profile as GitHubProfile } from 'passport-github2';
import type { Env } from '../../common/config/env';

export interface OAuthProfile {
  provider: 'GOOGLE' | 'GITHUB';
  providerAccountId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

/**
 * OAuth is optional: when credentials are absent the strategy registers with
 * placeholders and the controller returns 501 rather than crashing the app.
 */
export function oauthConfigured(config: ConfigService<Env, true>, provider: 'google' | 'github') {
  const id = config.get(provider === 'google' ? 'GOOGLE_CLIENT_ID' : 'GITHUB_CLIENT_ID', {
    infer: true,
  });
  const secret = config.get(
    provider === 'google' ? 'GOOGLE_CLIENT_SECRET' : 'GITHUB_CLIENT_SECRET',
    { infer: true },
  );
  return Boolean(id && secret);
}

@Injectable()
export class GoogleOAuthStrategy extends PassportStrategy(GoogleStrategy, 'google') {
  private static readonly logger = new Logger(GoogleOAuthStrategy.name);

  constructor(config: ConfigService<Env, true>) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID', { infer: true }) || 'not-configured',
      clientSecret: config.get('GOOGLE_CLIENT_SECRET', { infer: true }) || 'not-configured',
      callbackURL: `${config.get('OAUTH_CALLBACK_BASE', { infer: true })}/${config.get('API_PREFIX', { infer: true })}/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: GoogleProfile,
  ): OAuthProfile {
    const email = profile.emails?.[0]?.value;
    if (!email) throw new Error('Google account has no email address');

    return {
      provider: 'GOOGLE',
      providerAccountId: profile.id,
      email,
      name: profile.displayName || email.split('@')[0],
      avatarUrl: profile.photos?.[0]?.value,
    };
  }
}

@Injectable()
export class GitHubOAuthStrategy extends PassportStrategy(GitHubStrategy, 'github') {
  constructor(config: ConfigService<Env, true>) {
    super({
      clientID: config.get('GITHUB_CLIENT_ID', { infer: true }) || 'not-configured',
      clientSecret: config.get('GITHUB_CLIENT_SECRET', { infer: true }) || 'not-configured',
      callbackURL: `${config.get('OAUTH_CALLBACK_BASE', { infer: true })}/${config.get('API_PREFIX', { infer: true })}/auth/github/callback`,
      scope: ['user:email'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: GitHubProfile,
  ): OAuthProfile {
    const email =
      profile.emails?.[0]?.value ?? `${profile.username ?? profile.id}@users.noreply.github.com`;

    return {
      provider: 'GITHUB',
      providerAccountId: String(profile.id),
      email,
      name: profile.displayName || profile.username || email.split('@')[0],
      avatarUrl: profile.photos?.[0]?.value,
    };
  }
}
