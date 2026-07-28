import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { Env } from '../../common/config/env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { GitHubOAuthStrategy, GoogleOAuthStrategy, oauthConfigured } from './oauth.strategies';

/**
 * OAuth strategies are only registered when credentials exist, so a deployment
 * without them boots cleanly instead of failing on a missing client id.
 */
function oauthProviders(): Provider[] {
  return [
    {
      provide: GoogleOAuthStrategy,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        oauthConfigured(config, 'google') ? new GoogleOAuthStrategy(config) : undefined,
    },
    {
      provide: GitHubOAuthStrategy,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        oauthConfigured(config, 'github') ? new GitHubOAuthStrategy(config) : undefined,
    },
  ];
}

@Module({
  imports: [PassportModule.register({ session: false }), JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, ...oauthProviders()],
  exports: [AuthService],
})
export class AuthModule {}
