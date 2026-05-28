import { v4 as uuidv4 } from "uuid";
import type * as mysql from "mysql2/promise";
import type { AuditAction, AuditEntityType } from "./types";

export interface AuditLogEntry {
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  performed_by: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
}

export async function writeAuditLog(
  db: mysql.Pool,
  entry: AuditLogEntry
): Promise<void> {
  try {
    await db.execute(
      `INSERT INTO audit_logs
         (id, entity_type, entity_id, action, performed_by, metadata, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        uuidv4(),
        entry.entity_type,
        entry.entity_id,
        entry.action,
        entry.performed_by,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.ip_address ?? null,
      ]
    );
  } catch (err) {
    console.error("[audit] failed to write audit log:", err);
  }
}
