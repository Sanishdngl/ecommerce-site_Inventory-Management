import { cacheGet, cacheSet, cacheDel } from "@infrastructure/redis/redis";
import {
  generateRefreshToken,
  parseRefreshToken,
} from "@shared/auth/refresh-token";
import { BadRequestError, UnauthorizedError } from "@shared/errors";
import type {
  RotateRefreshTokenParams,
  RotateRefreshTokenResult,
  RefreshTokenPayload,
} from "@shared/types";

export async function rotateRefreshToken<TUser>(
  params: RotateRefreshTokenParams<TUser>
): Promise<RotateRefreshTokenResult<TUser>> {
  const {
    refreshToken,
    cacheKey,
    ttlSeconds,
    gracePeriodSeconds,
    findUser,
    isActive,
  } = params;

  if (!refreshToken) {
    throw new BadRequestError("refresh_token is required");
  }

  const parsed = parseRefreshToken(refreshToken);
  if (!parsed) {
    throw new UnauthorizedError("Refresh token malformed");
  }

  const { userId, deviceId } = parsed;
  const key = cacheKey(userId, deviceId);
  const raw = await cacheGet<string>(key);
  if (!raw) {
    throw new UnauthorizedError("Refresh token invalid or expired");
  }

  const stored: RefreshTokenPayload = JSON.parse(raw as any);
  const isCurrent = stored.token === refreshToken;
  const isPrevious =
    stored.previous_token === refreshToken &&
    !!stored.previous_token_expires_at &&
    Date.now() < stored.previous_token_expires_at;

  if (!isCurrent && !isPrevious) {
    throw new UnauthorizedError("Refresh token already rotated");
  }

  const user = await findUser(userId);
  if (!user || !isActive(user)) {
    await cacheDel(key);
    throw new UnauthorizedError("Account not found or deactivated");
  }

  if (isPrevious) {
    return {
      userId,
      deviceId,
      refreshToken: stored.token,
      user,
      rotated: false,
    };
  }

  const newRefreshToken = generateRefreshToken(userId, deviceId);
  const newPayload: RefreshTokenPayload = {
    token: newRefreshToken,
    previous_token: stored.token,
    previous_token_expires_at: Date.now() + gracePeriodSeconds * 1000,
    device_pixel_ratio: stored.device_pixel_ratio,
    created_at: new Date().toISOString(),
  };

  await cacheSet(key, JSON.stringify(newPayload), ttlSeconds);

  return {
    userId,
    deviceId,
    refreshToken: newRefreshToken,
    user,
    rotated: true,
  };
}
