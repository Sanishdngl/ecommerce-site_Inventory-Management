import { getDb } from "@infrastructure/database/mysql";
import { hashPassword, verifyPassword } from "@shared/auth/password";
import { handle, ConflictError, UnauthorizedError } from "@shared/errors";
import { cacheSet, cacheDel, TTL, CacheKey } from "@infrastructure/redis/redis";
import { logger } from "@infrastructure/observability/logger";
import {
  generateRefreshToken,
  parseRefreshToken,
} from "@shared/auth/refresh-token";
import { rotateRefreshToken } from "@shared/auth/rotate-refresh-token";
import { validateGrpc } from "@shared/grpc/validate-grpc";
import {
  RegisterSchema,
  LoginSchema,
  OAuthSchema,
} from "@shared/validation/customer.schema";
import type { RefreshTokenPayload } from "@shared/types";
import {
  findCustomerById,
  findCustomerByEmail,
  findCustomerByOAuth,
  insertCustomer,
} from "../db/customer.queries";
import { verifyOAuthToken } from "../auth/oauth";

const SERVICE_NAME = "customer-service";

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
  } = validateGrpc(RegisterSchema, call.request);

  const existing = await findCustomerByEmail(db, email);
  if (existing) throw new ConflictError("Email already registered");

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

  logger.info(SERVICE_NAME, "Customer registered", {
    customer_id: customer.id,
    email,
  });

  callback(null, {
    customer: sanitizeCustomer(customer),
    refresh_token: refreshToken,
  });
});

export const loginCustomer = handle(async (call, callback) => {
  const db = getDb();
  const { email, password, device_id, device_pixel_ratio } = validateGrpc(
    LoginSchema,
    call.request
  );

  const customer = await findCustomerByEmail(db, email);

  if (!customer || !customer.is_active || !customer.password_hash) {
    logger.warn(SERVICE_NAME, "Customer login failed: unknown or inactive account", {
      email,
    });
    throw new UnauthorizedError("Invalid credentials");
  }

  const valid = await verifyPassword(password, customer.password_hash);
  if (!valid) {
    logger.warn(SERVICE_NAME, "Customer login failed: bad password", {
      customer_id: customer.id,
      email,
    });
    throw new UnauthorizedError("Invalid credentials");
  }

  const refreshToken = await issueRefreshToken(
    customer.id,
    device_id,
    device_pixel_ratio ?? 1
  );

  logger.info(SERVICE_NAME, "Customer logged in", {
    customer_id: customer.id,
    email,
    device_id,
  });

  callback(null, {
    customer: sanitizeCustomer(customer),
    refresh_token: refreshToken,
  });
});

export const oAuthLogin = handle(async (call, callback) => {
  const db = getDb();
  const { provider, token, device_id, device_pixel_ratio } = validateGrpc(
    OAuthSchema,
    call.request
  );

  let profile;
  try {
    profile = await verifyOAuthToken(provider, token);
  } catch (err: any) {
    logger.warn(SERVICE_NAME, "OAuth verification failed", {
      provider,
      error: err.message,
    });
    throw new UnauthorizedError(err.message ?? "OAuth verification failed");
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
    logger.warn(SERVICE_NAME, "OAuth login blocked: account deactivated", {
      customer_id: customer.id,
    });
    throw new UnauthorizedError("Account is deactivated");
  }

  const refreshToken = await issueRefreshToken(
    customer.id,
    device_id,
    device_pixel_ratio ?? 1
  );

  logger.info(SERVICE_NAME, "Customer logged in via OAuth", {
    customer_id: customer.id,
    provider,
  });

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
  const db = getDb();

  const result = await rotateRefreshToken({
    refreshToken: refresh_token,
    cacheKey: CacheKey.refreshCustomer,
    ttlSeconds: TTL.REFRESH_TOKEN_CUSTOMER,
    gracePeriodSeconds: TTL.REFRESH_GRACE_PERIOD,
    findUser: (id) => findCustomerById(db, id),
    isActive: (customer) => customer.is_active,
  });

  callback(null, {
    customer_id: result.userId,
    refresh_token: result.refreshToken,
    customer: sanitizeCustomer(result.user),
  });
});
