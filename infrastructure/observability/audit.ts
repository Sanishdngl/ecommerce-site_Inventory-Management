import { v4 as uuidv4 } from "uuid";
import type * as mysql from "mysql2/promise";
import type { AuditLogEntry } from "@shared/types/index";
import { logger } from "./logger";

const SERVICE_NAME = process.env.SERVICE_NAME ?? "unknown-service";

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
    logger.error(SERVICE_NAME, "Failed to write audit log", {
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      action: entry.action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
