import crypto from "crypto";

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
