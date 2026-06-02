import { Router } from "express";
import {
  listCategories,
  listProducts,
  getProduct,
} from "../controllers/public.controller";

const router = Router();

router.get("/categories", listCategories);
router.get("/products", listProducts);
router.get("/products/:id", getProduct);

export default router;
