import { getDb } from "@shared/db";
import { hashPassword, verifyPassword } from "@shared/password";
import { Errors, handle } from "@shared/errors";
import { cacheSet, cacheGet, cacheDel, TTL, CacheKey } from "@shared/redis";
import { generateRefreshToken } from "@shared/jwt";
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

export const registerCustomer = handle(async (call, callback) => {
  const db = getDb();
  const { email, password, first_name, last_name } = call.request as any;

  if (!email || !password || !first_name || !last_name) {
    throw Errors.invalidArgument(
      "email, password, first_name, and last_name are required"
    );
  }

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

  const refreshToken = generateRefreshToken();
  await cacheSet(
    CacheKey.refreshCustomer(refreshToken),
    JSON.stringify({ customer_id: customer.id }),
    TTL.REFRESH_TOKEN_CUSTOMER
  );

  callback(null, {
    customer: sanitizeCustomer(customer),
    refresh_token: refreshToken,
  });
});

export const loginCustomer = handle(async (call, callback) => {
  const db = getDb();
  const { email, password } = call.request as any;

  if (!email || !password) {
    throw Errors.invalidArgument("email and password are required");
  }

  const customer = await findCustomerByEmail(db, email);

  if (!customer || !customer.is_active || !customer.password_hash) {
    throw Errors.unauthenticated("Invalid credentials");
  }

  const valid = await verifyPassword(password, customer.password_hash);
  if (!valid) throw Errors.unauthenticated("Invalid credentials");

  const refreshToken = generateRefreshToken();
  await cacheSet(
    CacheKey.refreshCustomer(refreshToken),
    JSON.stringify({ customer_id: customer.id }),
    TTL.REFRESH_TOKEN_CUSTOMER
  );

  callback(null, {
    customer: sanitizeCustomer(customer),
    refresh_token: refreshToken,
  });
});

export const oAuthLogin = handle(async (call, callback) => {
  const db = getDb();
  const { provider, token } = call.request as any;

  if (!provider || !token) {
    throw Errors.invalidArgument("provider and token are required");
  }

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

  const refreshToken = generateRefreshToken();
  await cacheSet(
    CacheKey.refreshCustomer(refreshToken),
    JSON.stringify({ customer_id: customer.id }),
    TTL.REFRESH_TOKEN_CUSTOMER
  );

  callback(null, {
    customer: sanitizeCustomer(customer),
    refresh_token: refreshToken,
  });
});

export const refreshCustomerToken = handle(async (call, callback) => {
  const { refresh_token } = call.request as any;

  if (!refresh_token) {
    throw Errors.invalidArgument("refresh_token is required");
  }

  const key = CacheKey.refreshCustomer(refresh_token);
  const raw = await cacheGet<string>(key);

  if (!raw) {
    throw Errors.unauthenticated("Refresh token invalid or expired");
  }

  const { customer_id } = JSON.parse(raw as any);

  const db = getDb();
  const customer = await findCustomerById(db, customer_id);

  if (!customer || !customer.is_active) {
    await cacheDel(key);
    throw Errors.unauthenticated("Customer account not found or deactivated");
  }

  await cacheDel(key);
  const newRefreshToken = generateRefreshToken();
  await cacheSet(
    CacheKey.refreshCustomer(newRefreshToken),
    JSON.stringify({ customer_id }),
    TTL.REFRESH_TOKEN_CUSTOMER
  );

  callback(null, {
    customer_id,
    refresh_token: newRefreshToken,
    customer: sanitizeCustomer(customer),
  });
});
