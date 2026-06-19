import { getDb } from "@shared/db";
import { hashPassword, verifyPassword } from "@shared/password";
import { Errors, handle } from "@shared/errors";
import { cacheSet, cacheGet, cacheDel, TTL, CacheKey } from "@shared/redis";
import { generateRefreshToken, parseRefreshToken } from "@shared/jwt";
import type { RefreshTokenPayload } from "@shared/types";
import {
  findCustomerById,
  findCustomerByEmail,
  findCustomerByOAuth,
  insertCustomer,
} from "../db/customer.queries";
import { verifyOAuthToken } from "../auth/oauth";

function sanitizeCustomer(customer: any) {
  const { password_hash, ...safe } = customer;
  return safe;
}

async function issueRefreshToken(
  customerId: string,
  deviceId: string,
  devicePixelRatio: number
): Promise<string> {
  const key = CacheKey.refreshCustomer(customerId, deviceId);
  const refreshToken = generateRefreshToken(customerId, deviceId);

  const payload: RefreshTokenPayload = {
    token: refreshToken,
    device_pixel_ratio: devicePixelRatio,
    created_at: new Date().toISOString(),
  };

  await cacheSet(key, JSON.stringify(payload), TTL.REFRESH_TOKEN_CUSTOMER);
  return refreshToken;
}

export const registerCustomer = handle(async (call, callback) => {
  const db = getDb();
  const {
    email,
    password,
    first_name,
    last_name,
    device_id,
    device_pixel_ratio,
  } = call.request as any;

  if (!email || !password || !first_name || !last_name) {
    throw Errors.invalidArgument(
      "email, password, first_name, and last_name are required"
    );
  }

  if (!device_id) throw Errors.invalidArgument("device_id is required");

  if (password.length < 8) {
    throw Errors.invalidArgument("Password must be at least 8 characters");
  }

  const existing = await findCustomerByEmail(db, email);
  if (existing) throw Errors.alreadyExists("Email already registered");

  const password_hash = await hashPassword(password);
  const customer = await insertCustomer(db, {
    email,
    password_hash,
    oauth_provider: null,
    oauth_id: null,
    first_name,
    last_name,
  });

  const refreshToken = await issueRefreshToken(
    customer.id,
    device_id,
    device_pixel_ratio ?? 1
  );

  callback(null, {
    customer: sanitizeCustomer(customer),
    refresh_token: refreshToken,
  });
});

export const loginCustomer = handle(async (call, callback) => {
  const db = getDb();
  const { email, password, device_id, device_pixel_ratio } =
    call.request as any;

  if (!email || !password) {
    throw Errors.invalidArgument("email and password are required");
  }

  if (!device_id) throw Errors.invalidArgument("device_id is required");

  const customer = await findCustomerByEmail(db, email);

  if (!customer || !customer.is_active || !customer.password_hash) {
    throw Errors.unauthenticated("Invalid credentials");
  }

  const valid = await verifyPassword(password, customer.password_hash);
  if (!valid) throw Errors.unauthenticated("Invalid credentials");

  const refreshToken = await issueRefreshToken(
    customer.id,
    device_id,
    device_pixel_ratio ?? 1
  );

  callback(null, {
    customer: sanitizeCustomer(customer),
    refresh_token: refreshToken,
  });
});

export const oAuthLogin = handle(async (call, callback) => {
  const db = getDb();
  const { provider, token, device_id, device_pixel_ratio } =
    call.request as any;

  if (!provider || !token) {
    throw Errors.invalidArgument("provider and token are required");
  }

  if (!device_id) throw Errors.invalidArgument("device_id is required");

  let profile;
  try {
    profile = await verifyOAuthToken(provider, token);
  } catch (err: any) {
    throw Errors.unauthenticated(err.message ?? "OAuth verification failed");
  }

  let customer = await findCustomerByOAuth(
    db,
    profile.oauth_provider,
    profile.oauth_id
  );

  if (!customer) {
    const byEmail = await findCustomerByEmail(db, profile.email);
    if (byEmail) {
      customer = byEmail;
    } else {
      customer = await insertCustomer(db, {
        email: profile.email,
        password_hash: null,
        oauth_provider: profile.oauth_provider,
        oauth_id: profile.oauth_id,
        first_name: profile.first_name,
        last_name: profile.last_name,
      });
    }
  }

  if (!customer.is_active) {
    throw Errors.unauthenticated("Account is deactivated");
  }

  const refreshToken = await issueRefreshToken(
    customer.id,
    device_id,
    device_pixel_ratio ?? 1
  );

  callback(null, {
    customer: sanitizeCustomer(customer),
    refresh_token: refreshToken,
  });
});

export const logoutCustomer = handle(async (call, callback) => {
  const { refresh_token } = call.request as any;

  if (refresh_token) {
    const parsed = parseRefreshToken(refresh_token);
    if (parsed) {
      const { userId: customer_id, deviceId: device_id } = parsed;
      const key = CacheKey.refreshCustomer(customer_id, device_id);
      await cacheDel(key);
    }
  }

  callback(null, { success: true, message: "Logged out" });
});

export const refreshCustomerToken = handle(async (call, callback) => {
  const { refresh_token } = call.request as any;
  if (!refresh_token) {
    throw Errors.invalidArgument("refresh_token is required");
  }

  const parsed = parseRefreshToken(refresh_token);
  if (!parsed) throw Errors.unauthenticated("Refresh token malformed");

  const { userId: customer_id, deviceId: device_id } = parsed;
  const key = CacheKey.refreshCustomer(customer_id, device_id);
  const raw = await cacheGet<string>(key);
  if (!raw) {
    throw Errors.unauthenticated("Refresh token invalid or expired");
  }

  // token matches just rotated previous token
  const stored: RefreshTokenPayload = JSON.parse(raw as any);
  const isCurrent = stored.token === refresh_token;
  const isPrevious =
    stored.previous_token === refresh_token &&
    stored.previous_token_expires_at &&
    Date.now() < stored.previous_token_expires_at;

  if (!isCurrent && !isPrevious) {
    throw Errors.unauthenticated("Refresh token already rotated");
  }

  const db = getDb();
  const customer = await findCustomerById(db, customer_id);

  if (!customer || !customer.is_active) {
    await cacheDel(key);
    throw Errors.unauthenticated("Customer account not found or deactivated");
  }

  // avoid rotation chain
  if (isPrevious) {
    callback(null, {
      customer_id,
      refresh_token: stored.token,
      customer: sanitizeCustomer(customer),
    });
    return;
  }

  // noramal rotation
  const newRefreshToken = generateRefreshToken(customer_id, device_id);
  const newPayload: RefreshTokenPayload = {
    token: newRefreshToken,
    previous_token: stored.token,
    previous_token_expires_at: Date.now() + TTL.REFRESH_GRACE_PERIOD * 1000,
    device_pixel_ratio: stored.device_pixel_ratio,
    created_at: new Date().toISOString(),
  };

  await cacheSet(key, JSON.stringify(newPayload), TTL.REFRESH_TOKEN_CUSTOMER);

  callback(null, {
    customer_id,
    refresh_token: newRefreshToken,
    customer: sanitizeCustomer(customer),
  });
});
