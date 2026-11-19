import { Response } from 'express';
import { SessionTokens } from './auth.types';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const ACCESS_TTL_MS = 15 * 60 * 1000;
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function baseOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

export function setAuthCookies(res: Response, tokens: SessionTokens) {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...baseOptions(), maxAge: ACCESS_TTL_MS });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...baseOptions(), maxAge: REFRESH_TTL_MS });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, baseOptions());
  res.clearCookie(REFRESH_COOKIE, baseOptions());
}
