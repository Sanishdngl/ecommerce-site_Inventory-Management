import { Router } from "express";
import {
  adminAuthMiddleware,
  requireRole,
} from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  ListAuditLogsSchema,
  GetInventoryStatsSchema,
} from "@shared/validation/system.schema";
import {
  getDashboardStats,
  getSystemHealth,
  getAuditLogs,
} from "../controllers/system.controller";

const router = Router();

// Read-only monitoring endpoints
router.get(
  "/dashboard-stats",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer", "reporter"),
  validate(GetInventoryStatsSchema, "query"),
  getDashboardStats
);

router.get(
  "/health",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer", "reporter"),
  getSystemHealth
);

router.get(
  "/audit-logs",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer", "reporter"),
  validate(ListAuditLogsSchema, "query"),
  getAuditLogs
);

export default router;
