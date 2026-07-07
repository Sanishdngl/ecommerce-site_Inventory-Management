import { Router } from "express";
import {
  adminAuthMiddleware,
  requireRole,
} from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { adminLoginRateLimiter } from "@shared/utils/rate-limits";
import {
  LoginAdminSchema,
  CreateAdminSchema,
  UpdateAdminSchema,
  DeleteAdminSchema,
  GetAdminSchema,
  ToggleStatusSchema,
  ListAdminSchema,
} from "@shared/validation/admin.schema";
import {
  loginAdmin,
  refreshAdmin,
  logoutAdmin,
  listAdminUsers,
  createAdminUser,
  getAdminUser,
  updateAdminUser,
  deleteAdminUser,
  toggleAdminStatus,
} from "../controllers/admin.controller";

const router = Router();

// Admin auth
router.post(
  "/auth/login",
  adminLoginRateLimiter,
  validate(LoginAdminSchema),
  loginAdmin
);
router.post("/auth/refresh", refreshAdmin);
router.post("/auth/logout", logoutAdmin);

//Admin users (super_admin) only
router.get(
  "/users",
  adminAuthMiddleware,
  requireRole("super_admin"),
  validate(ListAdminSchema, "query"),
  listAdminUsers
);
router.post(
  "/users",
  adminAuthMiddleware,
  requireRole("super_admin"),
  validate(CreateAdminSchema),
  createAdminUser
);
router.get(
  "/users/:id",
  adminAuthMiddleware,
  requireRole("super_admin"),
  validate(GetAdminSchema, "params"),
  getAdminUser
);
router.put(
  "/users/:id",
  adminAuthMiddleware,
  requireRole("super_admin"),
  validate(UpdateAdminSchema.pick({ id: true }), "params"),
  validate(UpdateAdminSchema.omit({ id: true })),
  updateAdminUser
);
router.delete(
  "/users/:id",
  adminAuthMiddleware,
  requireRole("super_admin"),
  validate(DeleteAdminSchema, "params"),
  deleteAdminUser
);
router.patch(
  "/users/:id/status",
  adminAuthMiddleware,
  requireRole("super_admin"),
  validate(ToggleStatusSchema, "params"),
  toggleAdminStatus
);

export default router;
