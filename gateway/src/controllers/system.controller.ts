import type { Request, Response, NextFunction } from "express";
import { getAdminClient } from "../grpc-clients/admin.client";
import { getCustomerClient } from "../grpc-clients/customer.client";
import { callGrpc, buildMeta } from "@shared/grpc/call-grpc";

export async function getDashboardStats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminClient = getAdminClient();
    const meta = buildMeta(req.admin!.admin_id, req.ip, req.admin!.role);

    const { low_stock_threshold } = req.query as {
      low_stock_threshold?: number;
    };

    const [stats, adminUsers] = await Promise.all([
      callGrpc<any, any>(
        adminClient,
        "GetInventoryStats",
        low_stock_threshold !== undefined ? { low_stock_threshold } : {},
        meta
      ),
      callGrpc<any, any>(
        adminClient,
        "ListAdminUsers",
        { pagination: { page: 1, limit: 1 } },
        meta
      ),
    ]);

    res.status(200).json({
      total_products: stats.total_products,
      total_categories: stats.total_categories,
      low_stock_count: stats.low_stock_count,
      total_admin_users: adminUsers.pagination.total,
    });
  } catch (err) {
    next(err);
  }
}

export async function getSystemHealth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminClient = getAdminClient();
    const customerClient = getCustomerClient();
    const meta = buildMeta(req.admin!.admin_id, req.ip, req.admin!.role);

    // Gateway's own status is implicit: if this handler is running, the
    // gateway is up — there's no separate ping to make for itself.
    const gateway = {
      service: "gateway",
      ok: true,
      message: "OK",
      checked_at: new Date().toISOString(),
    };

    const [adminHealth, customerHealth] = await Promise.all([
      callGrpc<any, any>(adminClient, "HealthCheck", {}, meta).catch((err) => ({
        admin: {
          service: "admin-service",
          ok: false,
          message: err instanceof Error ? err.message : String(err),
          checked_at: new Date().toISOString(),
        },
        inventory: {
          service: "inventory-service",
          ok: false,
          message: "Unreachable — admin-service health check failed",
          checked_at: new Date().toISOString(),
        },
      })),
      callGrpc<any, any>(customerClient, "HealthCheck", {}).catch((err) => ({
        service: "customer-service",
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        checked_at: new Date().toISOString(),
      })),
    ]);

    res.status(200).json({
      gateway,
      admin: adminHealth.admin,
      inventory: adminHealth.inventory,
      customer: customerHealth,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogs(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { page, limit, entity_type, action } = req.query as unknown as {
      page: number;
      limit: number;
      entity_type?: string;
      action?: string;
    };

    const adminClient = getAdminClient();
    const response = await callGrpc<any, any>(
      adminClient,
      "ListAuditLogs",
      { pagination: { page, limit }, entity_type, action },
      buildMeta(req.admin!.admin_id, req.ip, req.admin!.role)
    );

    res.status(200).json({
      ...response,
      logs: response.logs.map((l: any) => ({
        ...l,
        metadata: l.metadata ? JSON.parse(l.metadata) : null,
      })),
    });
  } catch (err) {
    next(err);
  }
}
