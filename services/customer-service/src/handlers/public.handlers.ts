import { handle } from "@shared/errors";
import { callInventory } from "../grpc-clients/inventory.client";

export const listPublicCategories = handle(async (call, callback) => {
  const result = await callInventory("ListCategories", {});
  callback(null, result);
});

export const listPublicProducts = handle(async (call, callback) => {
  const result = await callInventory("ListProducts", call.request as any);
  callback(null, result);
});

export const getPublicProduct = handle(async (call, callback) => {
  const result = await callInventory("GetProduct", call.request as any);
  callback(null, result);
});
