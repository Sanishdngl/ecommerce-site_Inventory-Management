import * as grpc from "@grpc/grpc-js";
import { getDb } from "@infrastructure/database/mysql";
import { verifyPassword } from "@shared/auth/password";
import { writeAuditLog } from "@infrastructure/observability/audit";
import { cacheSet, cacheDel, TTL, CacheKey } from "@infrastructure/redis/redis";
import { logger } from "@infrastructure/observability/logger";
import {
  generateRefreshToken,
  parseRefreshToken,
} from "@shared/auth/refresh-token";
import { rotateRefreshToken } from "@shared/auth/rotate-refresh-token";
import {
  handle,
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  UnauthorizedError,
} from "@shared/errors";
import { validateGrpc } from "@shared/grpc/validate-grpc";
import {
  LoginAdminSchema,
  CreateAdminGrpcSchema,
  UpdateAdminGrpcSchema,
  DeleteAdminSchema,
  GetAdminSchema,
  ToggleStatusSchema,
  ListAdminGrpcSchema,
} from "@shared/validation/admin.schema";
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
import { APP_TO_PROTO_ROLE, fromProtoRole } from "@shared/constants/roles";

const SERVICE_NAME = "admin-service";

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
    throw new ForbiddenError("Only Super Admin can perform this action");
  }
}

function sanitizeUser(user: any) {
  const { password_hash, ...safe } = user;
  return {
    ...safe,
    role: APP_TO_PROTO_ROLE[safe.role as AdminRole] ?? safe.role,
  };
}

export const loginAdmin = handle(async (call, callback) => {
  const db = getDb();
  const { username, password, device_id, device_pixel_ratio } = validateGrpc(
    LoginAdminSchema,
    call.request
  );

  const user = await findAdminByUsername(db, username);
  if (!user || !user.is_active) {
    logger.warn(SERVICE_NAME, "Admin login failed: unknown or inactive user", {
      username,
    });
    throw new UnauthorizedError("Invalid credentials");
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    logger.warn(SERVICE_NAME, "Admin login failed: bad password", {
      admin_id: user.id,
      username,
    });
    throw new UnauthorizedError("Invalid credentials");
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

  logger.info(SERVICE_NAME, "Admin logged in", {
    admin_id: user.id,
    username,
    device_id,
  });

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
  const {
    username,
    email,
    password,
    role: rawRole,
  } = validateGrpc(CreateAdminGrpcSchema, call.request);
  const role = fromProtoRole(rawRole);

  const validRoles: AdminRole[] = ["maintainer", "reporter"];
  if (!validRoles.includes(role as AdminRole)) {
    throw new BadRequestError("role must be maintainer or reporter");
  }

  const existingUsername = await findAdminByUsername(db, username);
  if (existingUsername) throw new ConflictError("Username already taken");

  const existingEmail = await findAdminByEmail(db, email);
  if (existingEmail) throw new ConflictError("Email already in use");

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

  logger.info(SERVICE_NAME, "Admin user created", {
    admin_id: user.id,
    username,
    role,
    performed_by: performedBy,
  });

  callback(null, { user: sanitizeUser(user) });
});

export const getAdminUser = handle(async (call, callback) => {
  requireSuperAdmin(call);

  const db = getDb();
  const { id } = validateGrpc(GetAdminSchema, call.request);

  const user = await findAdminById(db, id);
  if (!user) throw new NotFoundError("Admin user not found");

  callback(null, { user: sanitizeUser(user) });
});

export const updateAdminUser = handle(async (call, callback) => {
  requireSuperAdmin(call);

  const db = getDb();
  const rawRoleInput = (call.request as any).role as string | undefined;
  const {
    id,
    username,
    email,
    password,
    role: rawRole,
  } = validateGrpc(UpdateAdminGrpcSchema, {
    ...(call.request as any),
    role:
      rawRoleInput && rawRoleInput !== "ADMIN_ROLE_UNSPECIFIED"
        ? rawRoleInput
        : undefined,
  });
  const role = rawRole ? fromProtoRole(rawRole) : undefined;

  const existing = await findAdminById(db, id);
  if (!existing) throw new NotFoundError("Admin user not found");

  const updated = await dbUpdateAdminUser(db, id, {
    username,
    email,
    password,
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
  // Password changes are logged as a boolean flag only — never the value,
  // hash, or a from/to pair, unlike every other field above.
  if (password) diff.password = { from: "[redacted]", to: "[redacted]" };

  await writeAuditLog(db, {
    entity_type: "admin_user",
    entity_id: id,
    action: "update",
    performed_by: performedBy,
    metadata: { diff },
    ip_address: ipAddress,
  });

  logger.info(SERVICE_NAME, "Admin user updated", {
    admin_id: id,
    performed_by: performedBy,
    diff,
  });

  callback(null, { user: sanitizeUser(updated!) });
});

export const deleteAdminUser = handle(async (call, callback) => {
  requireSuperAdmin(call);

  const db = getDb();
  const { id } = validateGrpc(DeleteAdminSchema, call.request);

  const existing = await findAdminById(db, id);
  if (!existing) throw new NotFoundError("Admin user not found");

  const performedBy = getMetaValue(call, "admin_id")!;
  if (id === performedBy) {
    throw new ForbiddenError("Cannot delete your own account");
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

  logger.info(SERVICE_NAME, "Admin user deleted", {
    admin_id: id,
    username: existing.username,
    performed_by: performedBy,
  });

  callback(null, { success: true, message: "Admin user deleted" });
});

export const toggleAdminStatus = handle(async (call, callback) => {
  requireSuperAdmin(call);

  const db = getDb();
  const { id } = validateGrpc(ToggleStatusSchema, call.request);

  const existing = await findAdminById(db, id);
  if (!existing) throw new NotFoundError("Admin user not found");

  const performedBy = getMetaValue(call, "admin_id")!;
  if (id === performedBy) {
    throw new ForbiddenError("Cannot toggle your own status");
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

  logger.info(SERVICE_NAME, "Admin user status toggled", {
    admin_id: id,
    is_active: !existing.is_active,
    performed_by: performedBy,
  });

  callback(null, {
    success: true,
    message: `Admin user ${existing.is_active ? "deactivated" : "activated"}`,
  });
});

export const listAdminUsersHandler = handle(async (call, callback) => {
  requireSuperAdmin(call);

  const db = getDb();
  const { pagination } = validateGrpc(ListAdminGrpcSchema, call.request);
  const page = pagination?.page ?? 1;
  const limit = pagination?.limit ?? 20;
  const { users, total } = await listAdminUsers(db, page, limit);

  callback(null, {
    users: users.map(sanitizeUser),
    pagination: { total, page, limit },
  });
});

export const refreshAdminToken = handle(async (call, callback) => {
  const { refresh_token } = call.request as any;
  const db = getDb();

  const result = await rotateRefreshToken({
    refreshToken: refresh_token,
    cacheKey: CacheKey.refreshAdmin,
    ttlSeconds: TTL.REFRESH_TOKEN_ADMIN,
    gracePeriodSeconds: TTL.REFRESH_GRACE_PERIOD,
    findUser: (id) => findAdminById(db, id),
    isActive: (user) => user.is_active,
  });

  callback(null, {
    admin_id: result.userId,
    role: APP_TO_PROTO_ROLE[result.user.role] ?? result.user.role,
    refresh_token: result.refreshToken,
    user: sanitizeUser(result.user),
  });
});
