import { getDb } from "@shared/db";
import { hashPassword, verifyPassword } from "@shared/password";
import { Errors, handle } from "@shared/errors";
import {
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

  callback(null, { customer: sanitizeCustomer(customer) });
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

  callback(null, { customer: sanitizeCustomer(customer) });
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

  callback(null, { customer: sanitizeCustomer(customer) });
});
