import { handle } from "@shared/errors";
import { callGrpc } from "@shared/grpc/call-grpc";
import { getInventoryClient } from "@shared/grpc/inventory.client";

export const listPublicCategories = handle(async (call, callback) => {
  const result = await callGrpc(getInventoryClient(), "ListCategories", {});
  callback(null, result);
});

export const listPublicProducts = handle(async (call, callback) => {
  const result = await callGrpc(
    getInventoryClient(),
    "ListProducts",
    call.request as any
  );
  callback(null, result);
});

export const getPublicProduct = handle(async (call, callback) => {
  const result = await callGrpc(
    getInventoryClient(),
    "GetProduct",
    call.request as any
  );
  callback(null, result);
});
