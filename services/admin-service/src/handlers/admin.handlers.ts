import * as grpc from "@grpc/grpc-js";
import { getDb } from "@shared/db";
import { verifyPassword } from "@shared/password";
import { writeAuditLog } from "@shared/audit";
import { Errors, handle } from "@shared/errors";
import type { AdminRole } from "@shared/types";
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
  return safe;
}

export const loginAdmin = handle(async (call, callback) => {
  const db = getDb();
  const { username, password } = call.request as any;

  if (!username || !password) {
    throw Errors.invalidArgument("username and password are required");
  }

  const user = await findAdminByUsername(db, username);

  if (!user || !user.is_active) {
    throw Errors.unauthenticated("Invalid credentials");
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    throw Errors.unauthenticated("Invalid credentials");
  }

  callback(null, { user: sanitizeUser(user) });
});

export const createAdminUser = handle(async (call, callback) => {
  requireSuperAdmin(call);

  const db = getDb();
  const { username, email, password, role } = call.request as any;

  if (!username || !email || !password || !role) {
    throw Errors.invalidArgument(
      "username, email, password, and role are required"
    );
  }

  const validRoles: AdminRole[] = ["maintainer", "reporter"];
  if (!validRoles.includes(role)) {
    throw Errors.invalidArgument("role must be maintainer or reporter");
  }

  const existingUsername = await findAdminByUsername(db, username);
  if (existingUsername) throw Errors.alreadyExists("Username already taken");

  const existingEmail = await findAdminByEmail(db, email);
  if (existingEmail) throw Errors.alreadyExists("Email already in use");

  const user = await insertAdminUser(db, { username, email, password, role });
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
  const { id, username, email, role } = call.request as any;

  if (!id) throw Errors.invalidArgument("id is required");

  const existing = await findAdminById(db, id);
  if (!existing) throw Errors.notFound("Admin user not found");

  const updated = await dbUpdateAdminUser(db, id, { username, email, role });
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
