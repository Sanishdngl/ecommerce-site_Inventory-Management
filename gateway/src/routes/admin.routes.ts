import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  adminAuthMiddleware,
  requireRole,
} from "../middleware/auth.middleware";
import {
  loginAdmin,
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  toggleAdminStatus,
} from "../controllers/admin.controller";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many login attempts — try again later" },
});

router.post("/auth/login", loginLimiter, loginAdmin);
router.get(
  "/users",
  adminAuthMiddleware,
  requireRole("super_admin"),
  listAdminUsers
);
router.post(
  "/users",
  adminAuthMiddleware,
  requireRole("super_admin"),
  createAdminUser
);
router.put(
  "/users/:id",
  adminAuthMiddleware,
  requireRole("super_admin"),
  updateAdminUser
);
router.delete(
  "/users/:id",
  adminAuthMiddleware,
  requireRole("super_admin"),
  deleteAdminUser
);
router.patch(
  "/users/:id/status",
  adminAuthMiddleware,
  requireRole("super_admin"),
  toggleAdminStatus
);

export default router;
