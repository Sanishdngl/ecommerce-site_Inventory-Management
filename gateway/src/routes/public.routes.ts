import { Router } from "express";
import { validate } from "../middleware/validate.middleware";
import {
  PublicListProductsSchema,
  GetProductSchema,
} from "@shared/validation/inventory.schema";
import {
  listCategories,
  listProducts,
  getProduct,
} from "../controllers/public.controller";

const router = Router();

router.get("/categories", listCategories);
router.get(
  "/products",
  validate(PublicListProductsSchema, "query"),
  listProducts
);
router.get("/products/:id", validate(GetProductSchema, "params"), getProduct);

export default router;
