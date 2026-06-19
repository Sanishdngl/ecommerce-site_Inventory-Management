import * as grpc from "@grpc/grpc-js";
import { getDb } from "@shared/db";
import { verifyPassword } from "@shared/password";
import { writeAuditLog } from "@shared/audit";
import { cacheSet, cacheGet, cacheDel, TTL, CacheKey } from "@shared/redis";
import { generateRefreshToken, parseRefreshToken } from "@shared/jwt";
import { Errors, handle } from "@shared/errors";
import type { AdminRole, RefreshTokenPayload } from "@shared/types";
import {
  findAdminByUsername,
  findAdminById,
  findAdminByEmail,
  insertAdminUser,
  updateAdminUser as dbUpdateAdminUser,
  deleteAdminUser as dbDeleteAdminUser,
  toggleAdminStatus as dbToggleAdminStatus,
  listAdminUsers,
} from "../db/admin.queries";

const DB_TO_PROTO_ROLE: Record<string, string> = {
  super_admin: "SUPER_ADMIN",
  maintainer: "MAINTAINER",
  reporter: "REPORTER",
};

const PROTO_TO_DB_ROLE: Record<string, string> = {
  SUPER_ADMIN: "super_admin",
  MAINTAINER: "maintainer",
  REPORTER: "reporter",
};

function getMetaValue(
  call: grpc.ServerUnaryCall<any, any>,
  key: string
): string | undefined {
  const value = call.metadata.get(key);
  return value.length > 0 ? String(value[0]) : undefined;
}

function requireSuperAdmin(call: grpc.ServerUnaryCall<any, any>): void {
  const role = getMetaValue(call, "role");
  if (role !== "super_admin") {
    throw Errors.permissionDenied("Only Super Admin can perform this action");
  }
}

function sanitizeUser(user: any) {
  const { password_hash, ...safe } = user;
  return {
    ...safe,
    role: DB_TO_PROTO_ROLE[safe.role] ?? safe.role,
  };
}

export const loginAdmin = handle(async (call, callback) => {
  const db = getDb();
  const { username, password, device_id, device_pixel_ratio } =
    call.request as any;

  if (!username || !password) {
    throw Errors.invalidArgument("username and password are required");
  }
  if (!device_id) {
    throw Errors.invalidArgument("device_id is required");
  }

  const user = await findAdminByUsername(db, username);
  if (!user || !user.is_active) {
    throw Errors.unauthenticated("Invalid credentials");
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    throw Errors.unauthenticated("Invalid credentials");
  }

  const key = CacheKey.refreshAdmin(user.id, device_id);

  const refreshToken = generateRefreshToken(user.id, device_id);

  const payload: RefreshTokenPayload = {
    token: refreshToken,
    role: user.role,
    device_pixel_ratio: device_pixel_ratio ?? 1,
    created_at: new Date().toISOString(),
  };

  await cacheSet(key, JSON.stringify(payload), TTL.REFRESH_TOKEN_ADMIN);

  callback(null, { user: sanitizeUser(user), refresh_token: refreshToken });
});

export const logoutAdmin = handle(async (call, callback) => {
  const { refresh_token } = call.request as any;

  if (refresh_token) {
    const parsed = parseRefreshToken(refresh_token);
    if (parsed) {
      const { userId: admin_id, deviceId: device_id } = parsed;
      const key = CacheKey.refreshAdmin(admin_id, device_id);
      await cacheDel(key);
    }
  }

  callback(null, { success: true, message: "Logged out" });
});

export const createAdminUser = handle(async (call, callback) => {
  requireSuperAdmin(call);

  const db = getDb();
  const { username, email, password } = call.request as any;
  const rawRole = (call.request as any).role as string;
  const role = PROTO_TO_DB_ROLE[rawRole] ?? rawRole;

  if (!username || !email || !password || !role) {
    throw Errors.invalidArgument(
      "username, email, password, and role are required"
    );
  }

  const validRoles: AdminRole[] = ["maintainer", "reporter"];
  if (!validRoles.includes(role as AdminRole)) {
    throw Errors.invalidArgument("role must be maintainer or reporter");
  }

  const existingUsername = await findAdminByUsername(db, username);
  if (existingUsername) throw Errors.alreadyExists("Username already taken");

  const existingEmail = await findAdminByEmail(db, email);
  if (existingEmail) throw Errors.alreadyExists("Email already in use");

  const user = await insertAdminUser(db, {
    username,
    email,
    password,
    role: role as AdminRole,
  });
  const performedBy = getMetaValue(call, "admin_id")!;
  const ipAddress = getMetaValue(call, "ip_address");

  await writeAuditLog(db, {
    entity_type: "admin_user",
    entity_id: user.id,
    action: "create",
    performed_by: performedBy,
    metadata: { username, email, role },
    ip_address: ipAddress,
  });

  callback(null, { user: sanitizeUser(user) });
});

export const updateAdminUser = handle(async (call, callback) => {
  requireSuperAdmin(call);

  const db = getDb();
  const { id, username, email } = call.request as any;
  const rawRole = (call.request as any).role as string | undefined;
  const role =
    rawRole && rawRole !== "ADMIN_ROLE_UNSPECIFIED"
      ? PROTO_TO_DB_ROLE[rawRole] ?? rawRole
      : undefined;

  if (!id) throw Errors.invalidArgument("id is required");

  const existing = await findAdminById(db, id);
  if (!existing) throw Errors.notFound("Admin user not found");

  const updated = await dbUpdateAdminUser(db, id, {
    username,
    email,
    role: role as AdminRole | undefined,
  });
  const performedBy = getMetaValue(call, "admin_id")!;
  const ipAddress = getMetaValue(call, "ip_address");

  const diff: Record<string, { from: unknown; to: unknown }> = {};
  if (username && username !== existing.username)
    diff.username = { from: existing.username, to: username };
  if (email && email !== existing.email)
    diff.email = { from: existing.email, to: email };
  if (role && role !== existing.role)
    diff.role = { from: existing.role, to: role };

  await writeAuditLog(db, {
    entity_type: "admin_user",
    entity_id: id,
    action: "update",
    performed_by: performedBy,
    metadata: { diff },
    ip_address: ipAddress,
  });

  callback(null, { user: sanitizeUser(updated!) });
});

export const deleteAdminUser = handle(async (call, callback) => {
  requireSuperAdmin(call);

  const db = getDb();
  const { id } = call.request as any;

  if (!id) throw Errors.invalidArgument("id is required");

  const existing = await findAdminById(db, id);
  if (!existing) throw Errors.notFound("Admin user not found");

  const performedBy = getMetaValue(call, "admin_id")!;
  if (id === performedBy) {
    throw Errors.permissionDenied("Cannot delete your own account");
  }

  await dbDeleteAdminUser(db, id);

  const ipAddress = getMetaValue(call, "ip_address");

  await writeAuditLog(db, {
    entity_type: "admin_user",
    entity_id: id,
    action: "delete",
    performed_by: performedBy,
    metadata: { username: existing.username, role: existing.role },
    ip_address: ipAddress,
  });

  callback(null, { success: true, message: "Admin user deleted" });
});

export const toggleAdminStatus = handle(async (call, callback) => {
  requireSuperAdmin(call);

  const db = getDb();
  const { id } = call.request as any;
  if (!id) throw Errors.invalidArgument("id is required");

  const existing = await findAdminById(db, id);
  if (!existing) throw Errors.notFound("Admin user not found");

  const performedBy = getMetaValue(call, "admin_id")!;
  if (id === performedBy) {
    throw Errors.permissionDenied("Cannot toggle your own status");
  }

  await dbToggleAdminStatus(db, id);

  const ipAddress = getMetaValue(call, "ip_address");

  await writeAuditLog(db, {
    entity_type: "admin_user",
    entity_id: id,
    action: "update",
    performed_by: performedBy,
    metadata: {
      is_active: { from: existing.is_active, to: !existing.is_active },
    },
    ip_address: ipAddress,
  });

  callback(null, {
    success: true,
    message: `Admin user ${existing.is_active ? "deactivated" : "activated"}`,
  });
});

export const listAdminUsersHandler = handle(async (call, callback) => {
  requireSuperAdmin(call);

  const db = getDb();
  const { pagination } = call.request as any;
  const page = pagination?.page || 1;
  const limit = pagination?.limit || 20;
  const { users, total } = await listAdminUsers(db, page, limit);

  callback(null, {
    users: users.map(sanitizeUser),
    pagination: { total, page, limit },
  });
});

export const refreshAdminToken = handle(async (call, callback) => {
  const { refresh_token } = call.request as any;
  if (!refresh_token) {
    throw Errors.invalidArgument("refresh_token is required");
  }

  const parsed = parseRefreshToken(refresh_token);
  if (!parsed) {
    throw Errors.unauthenticated("Refresh token malformed");
  }

  const { userId: admin_id, deviceId: device_id } = parsed;
  const key = CacheKey.refreshAdmin(admin_id, device_id);
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
  const user = await findAdminById(db, admin_id);

  if (!user || !user.is_active) {
    await cacheDel(key);
    throw Errors.unauthenticated("Admin account not found or deactivated");
  }

  // avoids rotation chains
  if (isPrevious) {
    callback(null, {
      admin_id,
      role: DB_TO_PROTO_ROLE[user.role] ?? user.role,
      refresh_token: stored.token,
      user: sanitizeUser(user),
    });
    return;
  }

  // normal rotation
  const newRefreshToken = generateRefreshToken(admin_id, device_id);
  const newPayload: RefreshTokenPayload = {
    token: newRefreshToken,
    previous_token: stored.token,
    previous_token_expires_at: Date.now() + TTL.REFRESH_GRACE_PERIOD * 1000,
    role: user.role,
    device_pixel_ratio: stored.device_pixel_ratio,
    created_at: new Date().toISOString(),
  };

  await cacheSet(key, JSON.stringify(newPayload), TTL.REFRESH_TOKEN_ADMIN);

  callback(null, {
    admin_id,
    role: DB_TO_PROTO_ROLE[user.role] ?? user.role,
    refresh_token: newRefreshToken,
    user: sanitizeUser(user),
  });
});
