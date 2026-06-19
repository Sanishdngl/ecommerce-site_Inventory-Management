import { Router } from "express";
import rateLimit from "express-rate-limit";
import { customerAuthMiddleware } from "../middleware/auth.middleware";
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

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many attempts — try again later" },
});

router.post("/auth/register", authLimiter, registerCustomer);
router.post("/auth/login", authLimiter, loginCustomer);
router.post("/auth/oauth", authLimiter, oauthLogin);
router.post("/auth/refresh", refreshCustomer);
router.post("/auth/logout", logoutCustomer);

router.get("/profile", customerAuthMiddleware, getProfile);
router.put("/profile", customerAuthMiddleware, updateProfile);
router.get("/cart", customerAuthMiddleware, getCart);
router.post("/cart", customerAuthMiddleware, addToCart);
router.put("/cart/:productId", customerAuthMiddleware, updateCartItem);
router.delete("/cart/:productId", customerAuthMiddleware, removeFromCart);

export default router;
