import type { AdminRole } from "../types";

// Maps SUPER_ADMIN enum to super_admin value. The app role and DB role are
// the same value (role is stored as its app-layer string), so this single
// map covers both directions — no need for separate PROTO_TO_APP_ROLE /
// PROTO_TO_DB_ROLE names for one object.
export const PROTO_TO_APP_ROLE: Record<string, AdminRole> = {
  SUPER_ADMIN: "super_admin",
  MAINTAINER: "maintainer",
  REPORTER: "reporter",
};

export const APP_TO_PROTO_ROLE: Record<string, string> = {
  super_admin: "SUPER_ADMIN",
  maintainer: "MAINTAINER",
  reporter: "REPORTER",
};

export function normalizeRole(role: string): AdminRole {
  return PROTO_TO_APP_ROLE[role] ?? (role.toLowerCase() as AdminRole);
}

export function toProtoRole(role: AdminRole | string): string {
  return APP_TO_PROTO_ROLE[role as AdminRole] ?? role;
}

export function fromProtoRole(role: string): AdminRole {
  return PROTO_TO_APP_ROLE[role] ?? (role.toLowerCase() as AdminRole);
}
