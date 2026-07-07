import { z } from "zod";

export const RegisterSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  device_id: z.string().min(1),
  device_pixel_ratio: z.number().positive(),
});

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  device_id: z.string().min(1),
  device_pixel_ratio: z.number().positive(),
});

export const OAuthSchema = z.object({
  provider: z.string().min(1), // cross-check against OAUTH_SUPPORTED_PROVIDERS at runtime, not schema-time — env-driven, not a static enum
  token: z.string().min(1),
  device_id: z.string().min(1),
  device_pixel_ratio: z.number().positive(),
});

export const UpdateProfileSchema = z.object({
  customer_id: z.uuid(),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
});

export const CartItemSchema = z.object({
  customer_id: z.uuid(),
  product_id: z.uuid(),
  quantity: z.number().int().positive(), // matches proto comment: >0, use RemoveFromCart for zero
});

export const UpdateCartQuantitySchema = z.object({
  quantity: z.number().int().positive(),
});

export const CartProductParamSchema = z.object({
  productId: z.uuid(),
});

// ProfileRequest / GetCartRequest — customer_id is the only field on both.
// No gateway equivalent exists for these since the gateway derives
// customer_id from the auth token rather than a request body/param.
export const CustomerIdSchema = z.object({
  customer_id: z.uuid(),
});

// RemoveCartRequest — same shape as CartItemSchema minus quantity.
export const RemoveCartSchema = z.object({
  customer_id: z.uuid(),
  product_id: z.uuid(),
});
