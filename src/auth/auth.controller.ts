import { Body, Controller, Get, HttpCode, Logger, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { AuthResult, PublicUser } from './auth.types';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from './cookies';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  ActivateInstructorDto,
  ChangePasswordDto,
  CodeDto,
  EmailDto,
  LoginDto,
  RegisterDto,
  ResendCodeDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { GoogleService } from './google.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

const OAUTH_STATE_COOKIE = 'oauth_state';

@Controller('auth')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleService,
  ) {}

  private session(res: Response, result: AuthResult): PublicUser {
    setAuthCookies(res, result.tokens);
    return result.user;
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body() dto: CodeDto, @Res({ passthrough: true }) res: Response) {
    return this.session(res, await this.auth.verifyEmail(dto.email, dto.code));
  }

  @Post('resend-code')
  @HttpCode(200)
  async resendCode(@Body() dto: ResendCodeDto) {
    await this.auth.resendCode(dto.email, dto.purpose);
    return { message: 'Si la cuenta existe, enviamos un nuevo cÃ³digo a tu correo' };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return { user: this.session(res, await this.auth.login(dto.email, dto.password)) };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      return { user: this.session(res, await this.auth.refresh(req.cookies?.[REFRESH_COOKIE])) };
    } catch (err) {
      clearAuthCookies(res);
      throw err;
    }
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    clearAuthCookies(res);
    return { message: 'SesiÃ³n cerrada' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: PublicUser) {
    return user;
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: EmailDto) {
    await this.auth.forgotPassword(dto.email);
    return { message: 'Si la cuenta existe, enviamos un cÃ³digo a tu correo' };
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.email, dto.code, dto.newPassword);
    return { message: 'ContraseÃ±a actualizada' };
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: PublicUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
    setAuthCookies(res, result.tokens);
    return { message: 'ContraseÃ±a actualizada' };
  }

  @Post('instructor/activate')
  @HttpCode(200)
  async activateInstructor(@Body() dto: ActivateInstructorDto, @Res({ passthrough: true }) res: Response) {
    return { user: this.session(res, await this.auth.activateInstructor(dto.email, dto.code, dto.newPassword)) };
  }

  // ---------- Google OAuth ----------

  @Get('google')
  googleStart(@Res() res: Response) {
    const frontend = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    if (!this.google.isConfigured()) return res.redirect(`${frontend}/login?error=google`);
    const state = this.google.newState();
    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/auth/google',
      maxAge: 10 * 60 * 1000,
    });
    return res.redirect(this.google.buildAuthUrl(state));
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontend = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const expected = req.cookies?.[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/auth/google' });
    try {
      if (!code || !state || !expected || state !== expected) throw new Error('state invalido');
      const profile = await this.google.fetchProfile(code);
      const result = await this.auth.loginWithGoogle(profile);
      setAuthCookies(res, result.tokens);
      return res.redirect(`${frontend}/auth/callback`);
    } catch (err) {
      this.logger.warn(`Fallo Google OAuth: ${(err as Error).message}`);
      return res.redirect(`${frontend}/login?error=google`);
    }
  }
}
