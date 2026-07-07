import type { Request, Response } from "express";
import { BadRequestError } from "@shared/errors";
import type { RefreshCookieConfig } from "@shared/types";

export const ADMIN_REFRESH_COOKIE: RefreshCookieConfig = {
  name: "admin_refresh_token",
  maxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const CUSTOMER_REFRESH_COOKIE: RefreshCookieConfig = {
  name: "customer_refresh_token",
  maxAgeMs: 30 * 24 * 60 * 60 * 1000, // 30 days
};

const BASE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function setRefreshTokenCookie(
  res: Response,
  config: RefreshCookieConfig,
  token: string
): void {
  res.cookie(config.name, token, {
    ...BASE_COOKIE_OPTIONS,
    maxAge: config.maxAgeMs,
  });
}

export function clearRefreshTokenCookie(
  res: Response,
  config: RefreshCookieConfig
): void {
  res.clearCookie(config.name, { path: "/" });
}

// Lenient read for logout — a missing cookie there just means "already
// logged out", not a client error, so it must not throw.
export function getRefreshTokenCookie(
  req: Request,
  config: RefreshCookieConfig
): string | undefined {
  return req.cookies[config.name];
}

// Strict read for refresh — a missing cookie is a client error (400).
// This is the one presence check; refreshAdmin and refreshCustomer both
// call this instead of each re-implementing the null check.
export function requireRefreshTokenCookie(
  req: Request,
  config: RefreshCookieConfig
): string {
  const token = req.cookies[config.name];
  if (!token) {
    throw new BadRequestError("refresh_token is required");
  }
  return token;
}
