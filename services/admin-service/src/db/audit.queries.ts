import type mysql from "mysql2/promise";
import { clampPagination } from "@shared/utils/pagination";
import type { AuditAction, AuditEntityType } from "@shared/types";

export interface AuditLogRow {
  id: string;
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  performed_by: string;
  performed_by_username: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: Date;
}

export async function listAuditLogs(
  db: mysql.Pool,
  opts: {
    page: number;
    limit: number;
    entityType?: AuditEntityType;
    action?: AuditAction;
  }
): Promise<{ logs: AuditLogRow[]; total: number }> {
  const { safeLimit, safeOffset } = clampPagination(opts.page, opts.limit);

  const where: string[] = [];
  const params: any[] = [];

  if (opts.entityType) {
    where.push("al.entity_type = ?");
    params.push(opts.entityType);
  }
  if (opts.action) {
    where.push("al.action = ?");
    params.push(opts.action);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // LEFT JOIN — performed_by references admin_users, but that admin may have
  // since been deleted; the row must still surface (username falls back to
  // null client-side rather than the whole entry disappearing).
  const [rows] = await db.execute<any[]>(
    `SELECT al.*, au.username AS performed_by_username
     FROM audit_logs al
     LEFT JOIN admin_users au ON au.id = al.performed_by
     ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    params
  );

  const [[{ total }]] = await db.execute<any[]>(
    `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`,
    params
  );

  return { logs: rows, total: Number(total) };
}
