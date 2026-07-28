import {
  ExecutionContext,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Env } from '../../common/config/env';
import { oauthConfigured } from './oauth.strategies';

/**
 * Wraps the passport guard so an unconfigured provider returns a clear 501
 * instead of failing deep inside passport with "Unknown strategy".
 */
function guardFor(provider: 'google' | 'github') {
  @Injectable()
  class OAuthGuard extends AuthGuard(provider) {
    constructor(readonly config: ConfigService<Env, true>) {
      super();
    }

    canActivate(context: ExecutionContext) {
      if (!oauthConfigured(this.config, provider)) {
        const key = provider.toUpperCase();
        throw new NotImplementedException(
          `${provider} OAuth is not configured. Set ${key}_CLIENT_ID and ${key}_CLIENT_SECRET.`,
        );
      }
      return super.canActivate(context);
    }
  }
  return OAuthGuard;
}

export class GoogleAuthGuard extends guardFor('google') {}
export class GitHubAuthGuard extends guardFor('github') {}
