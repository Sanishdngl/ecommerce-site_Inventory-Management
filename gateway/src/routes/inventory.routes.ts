import { Router } from "express";
import {
  adminAuthMiddleware,
  requireRole,
} from "../middleware/auth.middleware";
import { bulkUploadMiddleware } from "../middleware/upload.middleware";
import { bulkUploadProducts } from "../controllers/inventory.controller";

const router = Router();

router.post(
  "/bulk-upload",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer"),
  bulkUploadMiddleware,
  bulkUploadProducts
);

export default router;
