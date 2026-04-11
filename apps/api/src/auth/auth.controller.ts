import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import type { AuthTokens } from '@mealy/types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const tokens = await this.authService.register(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const tokens = await this.authService.login(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async refresh(
    @Req() req: Request,
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const rawToken =
      (req.cookies as Record<string, string> | undefined)?.['refresh_token'] ??
      dto.refreshToken;
    if (!rawToken) {
      this.clearRefreshCookie(res);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    try {
      const tokens = await this.authService.refresh(rawToken);
      this.setRefreshCookie(res, tokens.refreshToken);
      return { accessToken: tokens.accessToken };
    } catch (e) {
      this.clearRefreshCookie(res);
      throw e;
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request & { user: { id: string } },
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(req.user.id);
    res.clearCookie('refresh_token');
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // Passport redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleCallback(
    @Req() req: Request & { user: AuthTokens },
    @Res() res: Response,
  ): void {
    const tokens = req.user;
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    // Pass the refresh token as `rt` so the frontend can exchange it through
    // its same-origin proxy, setting the cookie on the correct domain.
    res.redirect(
      `${frontendUrl}/callback?token=${tokens.accessToken}&rt=${tokens.refreshToken}`,
    );
  }

  private setRefreshCookie(res: Response, token: string): void {
    const secure = process.env.NODE_ENV === 'production';
    const sameSite = secure ? 'none' : ('lax' as const);
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge,
      path: '/',
    });
    // Non-httpOnly indicator so client JS can check for an active session
    // without exposing the token value.
    res.cookie('has_session', '1', {
      httpOnly: false,
      secure,
      sameSite,
      maxAge,
      path: '/',
    });
  }

  private clearRefreshCookie(res: Response): void {
    const secure = process.env.NODE_ENV === 'production';
    const sameSite = secure ? 'none' : ('lax' as const);
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
    });
    res.clearCookie('has_session', {
      httpOnly: false,
      secure,
      sameSite,
      path: '/',
    });
  }
}
