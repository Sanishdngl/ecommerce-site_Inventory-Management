import * as jwt from "jsonwebtoken";
import crypto from 'crypto';
import type { AdminJWTPayload, CustomerJWTPayload } from "./types";

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
      "15m") as jwt.SignOptions["expiresIn"],
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
      "15m") as jwt.SignOptions["expiresIn"],
  });
}

export function verifyCustomerJWT(token: string): CustomerJWTPayload {
  return jwt.verify(token, getPublicKey(), {
    algorithms: ["RS256"],
  }) as CustomerJWTPayload;
}

export function generateRefreshToken(userId: string, deviceId: string): string {
  const prefix = Buffer.from(JSON.stringify({ userId, deviceId })).toString(
    "base64url"
  );
  const random = crypto.randomBytes(32).toString("hex");
  return `${prefix}.${random}`;
}

export function parseRefreshToken(
  token: string
): { userId: string; deviceId: string } | null {
  try {
    const [prefix] = token.split(".");
    if (!prefix) return null;
    const decoded = JSON.parse(
      Buffer.from(prefix, "base64url").toString("utf8")
    );
    if (!decoded.userId || !decoded.deviceId) return null;
    return decoded;
  } catch {
    return null;
  }
}