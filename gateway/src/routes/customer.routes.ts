import { Router } from "express";
import { customerAuthMiddleware } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { customerAuthRateLimiter } from "@shared/utils/rate-limits";
import {
  RegisterSchema,
  LoginSchema,
  OAuthSchema,
  UpdateProfileSchema,
  CartItemSchema,
  UpdateCartQuantitySchema,
  CartProductParamSchema,
} from "@shared/validation/customer.schema";
import {
  registerCustomer,
  loginCustomer,
  oauthLogin,
  refreshCustomer,
  logoutCustomer,
  getProfile,
  updateProfile,
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
} from "../controllers/customer.controller";

const router = Router();

router.post(
  "/auth/register",
  customerAuthRateLimiter,
  validate(RegisterSchema),
  registerCustomer
);
router.post(
  "/auth/login",
  customerAuthRateLimiter,
  validate(LoginSchema),
  loginCustomer
);
router.post(
  "/auth/oauth",
  customerAuthRateLimiter,
  validate(OAuthSchema),
  oauthLogin
);
router.post("/auth/refresh", refreshCustomer);
router.post("/auth/logout", logoutCustomer);

router.get("/profile", customerAuthMiddleware, getProfile);
router.put(
  "/profile",
  customerAuthMiddleware,
  validate(UpdateProfileSchema.omit({ customer_id: true })),
  updateProfile
);
router.get("/cart", customerAuthMiddleware, getCart);
router.post(
  "/cart",
  customerAuthMiddleware,
  validate(CartItemSchema.omit({ customer_id: true })),
  addToCart
);
router.put(
  "/cart/:productId",
  customerAuthMiddleware,
  validate(CartProductParamSchema, "params"),
  validate(UpdateCartQuantitySchema),
  updateCartItem
);
router.delete(
  "/cart/:productId",
  customerAuthMiddleware,
  validate(CartProductParamSchema, "params"),
  removeFromCart
);

export default router;
