import { getDb, testDbConnection } from "@infrastructure/database/mysql";
import { testRedisConnection } from "@infrastructure/redis/redis";
import { callGrpc } from "@shared/grpc/call-grpc";
import { getInventoryClient } from "@shared/grpc/inventory.client";
import { handle } from "@shared/errors";
import { validateGrpc } from "@shared/grpc/validate-grpc";
import { ListAuditLogsGrpcSchema } from "@shared/validation/system.schema";
import { logger } from "@infrastructure/observability/logger";
import { listAuditLogs } from "../db/audit.queries";

const SERVICE_NAME = "admin-service";

export const listAuditLogsHandler = handle(async (call, callback) => {
  const db = getDb();
  const { pagination, entity_type, action } = validateGrpc(
    ListAuditLogsGrpcSchema,
    call.request
  );
  const page = pagination?.page ?? 1;
  const limit = pagination?.limit ?? 20;

  const { logs, total } = await listAuditLogs(db, {
    page,
    limit,
    entityType: entity_type,
    action,
  });

  callback(null, {
    logs: logs.map((l) => ({
      id: l.id,
      entity_type: l.entity_type,
      entity_id: l.entity_id,
      action: l.action,
      performed_by: l.performed_by,
      performed_by_username: l.performed_by_username ?? "",
      metadata: l.metadata ? JSON.stringify(l.metadata) : "",
      ip_address: l.ip_address ?? "",
      created_at: new Date(l.created_at).toISOString(),
    })),
    pagination: { total, page, limit },
  });
});

export function healthCheck(_call: any, callback: any): void {
  const adminCheck = Promise.all([testDbConnection(), testRedisConnection()])
    .then(() => ({
      service: SERVICE_NAME,
      ok: true,
      message: "OK",
      checked_at: new Date().toISOString(),
    }))
    .catch((err) => ({
      service: SERVICE_NAME,
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      checked_at: new Date().toISOString(),
    }));

  const inventoryCheck = callGrpc<any, any>(
    getInventoryClient(),
    "HealthCheck",
    {}
  ).catch((err) => {
    logger.warn(SERVICE_NAME, "Inventory health check failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      service: "inventory-service",
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      checked_at: new Date().toISOString(),
    };
  });

  Promise.all([adminCheck, inventoryCheck]).then(([admin, inventory]) => {
    callback(null, { admin, inventory });
  });
}
