import { getDb } from "@infrastructure/database/mysql";
import {
  cacheGet,
  cacheSet,
  cacheDel,
  TTL,
  CacheKey,
} from "@infrastructure/redis/redis";
import { handle, NotFoundError } from "@shared/errors";
import { callGrpc } from "@shared/grpc/call-grpc";
import { validateGrpc } from "@shared/grpc/validate-grpc";
import {
  CartItemSchema,
  RemoveCartSchema,
  CustomerIdSchema,
} from "@shared/validation/customer.schema";
import type { EnrichedCartItem } from "@shared/types";
import {
  upsertCartItem,
  setCartItemQuantity,
  removeCartItem,
  getRawCartItems,
  cartItemExists,
} from "../db/cart.queries";
import { findCustomerById } from "../db/customer.queries";
import { getInventoryClient } from "@shared/grpc/inventory.client";

async function buildCart(
  db: any,
  customerId: string
): Promise<EnrichedCartItem[]> {
  const cartItems = await getRawCartItems(db, customerId);
  if (cartItems.length === 0) return [];

  const ids = cartItems.map((i) => i.product_id);
  const response = await callGrpc<any, any>(
    getInventoryClient(),
    "GetProductsByIds",
    { ids }
  );
  const productMap = new Map(
    (response.products as any[]).map((p: any) => [p.id, p])
  );

  return cartItems
    .filter((ci) => productMap.has(ci.product_id))
    .map((ci) => {
      const p = productMap.get(ci.product_id)!;
      return {
        product_id: ci.product_id,
        product_name: p.name,
        price: p.price,
        thumbnail_url: p.thumbnail_url ?? null,
        quantity: ci.quantity,
        stock_quantity: p.stock_quantity,
      };
    });
}

export const addToCart = handle(async (call, callback) => {
  const db = getDb();
  const { customer_id, product_id, quantity } = validateGrpc(
    CartItemSchema,
    call.request
  );

  const customer = await findCustomerById(db, customer_id);
  if (!customer) throw new NotFoundError("Customer not found");

  await upsertCartItem(db, customer_id, product_id, quantity);
  await cacheDel(CacheKey.cart(customer_id));

  const items = await buildCart(db, customer_id);
  await cacheSet(CacheKey.cart(customer_id), items, TTL.CART);

  callback(null, { items });
});

export const updateCartItem = handle(async (call, callback) => {
  const db = getDb();
  const { customer_id, product_id, quantity } = validateGrpc(
    CartItemSchema,
    call.request
  );

  const exists = await cartItemExists(db, customer_id, product_id);
  if (!exists) throw new NotFoundError("Cart item not found");

  await setCartItemQuantity(db, customer_id, product_id, quantity);
  await cacheDel(CacheKey.cart(customer_id));

  const items = await buildCart(db, customer_id);
  await cacheSet(CacheKey.cart(customer_id), items, TTL.CART);

  callback(null, { items });
});

export const removeFromCart = handle(async (call, callback) => {
  const db = getDb();
  const { customer_id, product_id } = validateGrpc(
    RemoveCartSchema,
    call.request
  );

  const exists = await cartItemExists(db, customer_id, product_id);
  if (!exists) throw new NotFoundError("Cart item not found");

  await removeCartItem(db, customer_id, product_id);
  await cacheDel(CacheKey.cart(customer_id));

  const items = await buildCart(db, customer_id);
  await cacheSet(CacheKey.cart(customer_id), items, TTL.CART);

  callback(null, { items });
});

export const getCart = handle(async (call, callback) => {
  const db = getDb();
  const { customer_id } = validateGrpc(CustomerIdSchema, call.request);

  const cached = await cacheGet<EnrichedCartItem[]>(CacheKey.cart(customer_id));
  if (cached) {
    callback(null, { items: cached });
    return;
  }

  const items = await buildCart(db, customer_id);
  await cacheSet(CacheKey.cart(customer_id), items, TTL.CART);

  callback(null, { items });
});
