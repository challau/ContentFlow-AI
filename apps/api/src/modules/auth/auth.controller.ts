import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { Env } from '../../common/config/env';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterDto } from './auth.dto';
import type { OAuthProfile } from './oauth.strategies';
import { GitHubAuthGuard, GoogleAuthGuard } from './oauth.guards';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create an account, organization and default brand kit' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange email and password for tokens' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.email, dto.password, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token for a new token pair' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a refresh token' })
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user, organization and role' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id, user.organizationId);
  }

  // --- OAuth ---------------------------------------------------------------

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  @ApiOperation({ summary: 'Begin Google OAuth' })
  google(): void {
    // The guard issues the redirect; this body never runs.
  }

  @Public()
  @UseGuards(GitHubAuthGuard)
  @Get('github')
  @ApiOperation({ summary: 'Begin GitHub OAuth' })
  github(): void {
    // The guard issues the redirect; this body never runs.
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.completeOAuth(req.user as OAuthProfile, res);
  }

  @Public()
  @UseGuards(GitHubAuthGuard)
  @Get('github/callback')
  async githubCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.completeOAuth(req.user as OAuthProfile, res);
  }

  private async completeOAuth(profile: OAuthProfile, res: Response): Promise<void> {
    const result = await this.auth.oauthLogin({
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    });

    // Tokens go in the fragment so they never land in server logs or Referer.
    const webApp = this.config.get('WEB_APP_URL', { infer: true });
    const fragment = new URLSearchParams({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    });
    res.redirect(`${webApp}/auth/callback#${fragment.toString()}`);
  }
}
