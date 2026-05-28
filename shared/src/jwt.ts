import * as jwt from "jsonwebtoken";
import type { AdminJWTPayload, CustomerJWTPayload } from "./types";
import * as bcrypt from "bcrypt";

function getPrivateKey(): string {
  const key = process.env.JWT_PRIVATE_KEY;
  if (!key) throw new Error("JWT_PRIVATE_KEY is not set");
  return key.replace(/\\n/g, "\n");
}

function getPublicKey(): string {
  const key = process.env.JWT_PUBLIC_KEY;
  if (!key) throw new Error("JWT_PUBLIC_KEY is not set");
  return key.replace(/\\n/g, "\n");
}

export function signAdminJWT(payload: Omit<AdminJWTPayload, "exp">): string {
  return jwt.sign(payload, getPrivateKey(), {
    algorithm: "RS256",
    expiresIn: (process.env.JWT_EXPIRES_IN_ADMIN ??
      "8h") as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAdminJWT(token: string): AdminJWTPayload {
  return jwt.verify(token, getPublicKey(), {
    algorithms: ["RS256"],
  }) as AdminJWTPayload;
}

export function signCustomerJWT(
  payload: Omit<CustomerJWTPayload, "exp">
): string {
  return jwt.sign(payload, getPrivateKey(), {
    algorithm: "RS256",
    expiresIn: (process.env.JWT_EXPIRES_IN_CUSTOMER ??
      "24h") as jwt.SignOptions["expiresIn"],
  });
}

export function verifyCustomerJWT(token: string): CustomerJWTPayload {
  return jwt.verify(token, getPublicKey(), {
    algorithms: ["RS256"],
  }) as CustomerJWTPayload;
}

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
