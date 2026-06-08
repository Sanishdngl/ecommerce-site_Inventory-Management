import { Router } from "express";
import {
  adminAuthMiddleware,
  requireRole,
} from "../middleware/auth.middleware";
import { bulkUploadMiddleware } from "../middleware/upload.middleware";
import {
  createCategory,
  listCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  listProducts,
  getProduct,
  updateStock,
  bulkUploadProducts,
} from "../controllers/inventory.controller";
const router = Router();

router.post(
  "/categories",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer"),
  createCategory
);
router.get(
  "/categories",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer", "reporter"),
  listCategories
);
router.post(
  "/products",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer"),
  createProduct
);
router.get(
  "/products",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer", "reporter"),
  listProducts
);
router.get(
  "/products/:id",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer", "reporter"),
  getProduct
);
router.put(
  "/products/:id",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer"),
  updateProduct
);
router.delete(
  "/products/:id",
  adminAuthMiddleware,
  requireRole("super_admin"),
  deleteProduct
);
router.patch(
  "/products/:id/stock",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer"),
  updateStock
);
router.post(
  "/bulk-upload",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer"),
  bulkUploadMiddleware,
  bulkUploadProducts
);

export default router;
