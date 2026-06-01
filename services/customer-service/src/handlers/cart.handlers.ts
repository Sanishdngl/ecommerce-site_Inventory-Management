import { getDb } from "@shared/db";
import { cacheGet, cacheSet, cacheDel, TTL, CacheKey } from "@shared/redis";
import { Errors, handle } from "@shared/errors";
import type { EnrichedCartItem } from "../db/cart.queries";
import {
  upsertCartItem,
  setCartItemQuantity,
  removeCartItem,
  getEnrichedCart,
  cartItemExists,
} from "../db/cart.queries";
import { findCustomerById } from "../db/customer.queries";

export const addToCart = handle(async (call, callback) => {
  const db = getDb();
  const { customer_id, product_id, quantity } = call.request as any;

  if (!customer_id || !product_id) {
    throw Errors.invalidArgument("customer_id and product_id are required");
  }
  if (!quantity || quantity <= 0) {
    throw Errors.invalidArgument("quantity must be greater than zero");
  }

  const customer = await findCustomerById(db, customer_id);
  if (!customer) throw Errors.notFound("Customer not found");

  await upsertCartItem(db, customer_id, product_id, quantity);
  await cacheDel(CacheKey.cart(customer_id));

  const items = await getEnrichedCart(db, customer_id);
  await cacheSet(CacheKey.cart(customer_id), items, TTL.CART);

  callback(null, { items });
});

export const updateCartItem = handle(async (call, callback) => {
  const db = getDb();
  const { customer_id, product_id, quantity } = call.request as any;

  if (!customer_id || !product_id) {
    throw Errors.invalidArgument("customer_id and product_id are required");
  }

  if (!quantity || quantity <= 0) {
    throw Errors.invalidArgument(
      "quantity must be greater than zero — use RemoveFromCart to remove an item"
    );
  }

  const exists = await cartItemExists(db, customer_id, product_id);
  if (!exists) throw Errors.notFound("Cart item not found");

  await setCartItemQuantity(db, customer_id, product_id, quantity);
  await cacheDel(CacheKey.cart(customer_id));

  const items = await getEnrichedCart(db, customer_id);
  await cacheSet(CacheKey.cart(customer_id), items, TTL.CART);

  callback(null, { items });
});

export const removeFromCart = handle(async (call, callback) => {
  const db = getDb();
  const { customer_id, product_id } = call.request as any;

  if (!customer_id || !product_id) {
    throw Errors.invalidArgument("customer_id and product_id are required");
  }

  const exists = await cartItemExists(db, customer_id, product_id);
  if (!exists) throw Errors.notFound("Cart item not found");

  await removeCartItem(db, customer_id, product_id);
  await cacheDel(CacheKey.cart(customer_id));

  const items = await getEnrichedCart(db, customer_id);
  await cacheSet(CacheKey.cart(customer_id), items, TTL.CART);

  callback(null, { items });
});

export const getCart = handle(async (call, callback) => {
  const db = getDb();
  const { customer_id } = call.request as any;

  if (!customer_id) throw Errors.invalidArgument("customer_id is required");

  const cached = await cacheGet<EnrichedCartItem[]>(CacheKey.cart(customer_id));
  if (cached) {
    callback(null, { items: cached });
    return;
  }

  const items = await getEnrichedCart(db, customer_id);
  await cacheSet(CacheKey.cart(customer_id), items, TTL.CART);

  callback(null, { items });
});
