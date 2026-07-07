import { Router } from "express";
import {
  adminAuthMiddleware,
  requireRole,
} from "../middleware/auth.middleware";
import {
  bulkUploadMiddleware,
  singleImageUploadMiddleware,
} from "../middleware/upload.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  CreateCategorySchema,
  GetCategorySchema,
  UpdateCategorySchema,
  DeleteCategorySchema,
  CreateProductSchema,
  UpdateProductSchema,
  UpdateStockSchema,
  GetProductSchema,
  DeleteProductSchema,
  ListProductsSchema,
} from "@shared/validation/inventory.schema";
import { UploadImageSchema } from "@shared/validation/system.schema";
import {
  createCategory,
  listCategories,
  getCategory,
  updateCategory,
  deleteCategory,
  createProduct,
  updateProduct,
  deleteProduct,
  listProducts,
  getProduct,
  updateStock,
  uploadProductImage,
  bulkUploadProducts,
} from "../controllers/inventory.controller";
const router = Router();

router.post(
  "/categories",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer"),
  validate(CreateCategorySchema),
  createCategory
);
router.get(
  "/categories",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer", "reporter"),
  listCategories
);
router.get(
  "/categories/:id",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer", "reporter"),
  validate(GetCategorySchema, "params"),
  getCategory
);
router.put(
  "/categories/:id",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer"),
  validate(UpdateCategorySchema.pick({ id: true }), "params"),
  validate(UpdateCategorySchema.omit({ id: true })),
  updateCategory
);
router.delete(
  "/categories/:id",
  adminAuthMiddleware,
  requireRole("super_admin"),
  validate(DeleteCategorySchema, "params"),
  deleteCategory
);
router.post(
  "/products",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer"),
  validate(CreateProductSchema),
  createProduct
);
router.get(
  "/products",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer", "reporter"),
  validate(ListProductsSchema, "query"),
  listProducts
);
router.get(
  "/products/:id",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer", "reporter"),
  validate(GetProductSchema, "params"),
  getProduct
);
router.put(
  "/products/:id",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer"),
  validate(UpdateProductSchema.pick({ id: true }), "params"),
  validate(UpdateProductSchema.omit({ id: true })),
  updateProduct
);
router.delete(
  "/products/:id",
  adminAuthMiddleware,
  requireRole("super_admin"),
  validate(DeleteProductSchema, "params"),
  deleteProduct
);
router.patch(
  "/products/:id/stock",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer"),
  validate(GetProductSchema, "params"),
  validate(UpdateStockSchema.omit({ product_id: true })),
  updateStock
);
router.post(
  "/products/:id/image",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer"),
  validate(GetProductSchema, "params"),
  singleImageUploadMiddleware,
  validate(UploadImageSchema),
  uploadProductImage
);
router.post(
  "/bulk-upload",
  adminAuthMiddleware,
  requireRole("super_admin", "maintainer"),
  bulkUploadMiddleware,
  bulkUploadProducts
);

export default router;
