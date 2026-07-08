import { z } from "zod";

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a valid slug"),
});

export const CreateProductSchema = z.object({
  category_id: z.uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  price: z
    .string()
    .regex(/^\d+\.\d{2}$/, "must be a decimal string like '19.99'"),
  // Price is string in proto — avoid z.number() to prevent float precision loss
  stock_quantity: z.number().int().nonnegative(),
});

export const UpdateProductSchema = z.object({
  id: z.uuid(),
  category_id: z.uuid().optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  price: z
    .string()
    .regex(/^\d+\.\d{2}$/)
    .optional(),
  is_active: z.boolean().optional(),
});

export const DeleteProductSchema = z.object({
  id: z.uuid(),
});

export const GetProductSchema = z.object({
  id: z.uuid(),
});

export const ListProductsSchema = z.object({
  category_id: z.uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  // Admin-only: surfaces soft-deleted/deactivated products so they can be
  // reactivated. Never exposed on PublicListProductsSchema.
  include_inactive: z.coerce.boolean().optional(),
});

// Public storefront takes a category slug, not category_id — separate shape,
// same pagination bounds.
export const PublicListProductsSchema = z.object({
  category: z.string().min(1).max(100).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const ListCategoriesSchema = z.object({}); // No fields — matches empty proto message; kept for symmetry/future use

export const GetCategorySchema = z.object({
  id: z.uuid(),
});

export const UpdateCategorySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a valid slug")
    .optional(),
});

export const DeleteCategorySchema = z.object({
  id: z.uuid(),
});

// gRPC-layer variant of ListProductsSchema — proto nests pagination under
// `pagination: { page, limit }`, unlike the gateway's flat query-string
// shape above. Used at the InventoryService boundary itself, since that's
// reachable directly (from admin-service's proxy and customer-service's
// public passthrough) without going through the gateway's query parsing.
export const ListProductsGrpcSchema = z.object({
  category_id: z.uuid().optional(),
  pagination: z
    .object({
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    })
    .optional(),
  include_inactive: z.boolean().optional(),
});

export const UpdateStockSchema = z.object({
  product_id: z.uuid(),
  delta: z.number().int(), // Signed — reject if result < 0; check stays in handler
  reason: z.string().max(255).optional(),
});
