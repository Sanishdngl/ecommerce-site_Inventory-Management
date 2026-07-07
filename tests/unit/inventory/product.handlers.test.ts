const mockExecute = jest.fn();
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheDel = jest.fn();
const mockCacheDelPattern = jest.fn();

jest.mock("@infrastructure/database/mysql", () => ({
  getDb: () => ({ execute: mockExecute }),
}));
jest.mock("@infrastructure/observability/audit", () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@infrastructure/redis/redis", () => ({
  cacheGet: (...args: any[]) => mockCacheGet(...args),
  cacheSet: (...args: any[]) => mockCacheSet(...args),
  cacheDel: (...args: any[]) => mockCacheDel(...args),
  cacheDelPattern: (...args: any[]) => mockCacheDelPattern(...args),
  TTL: { PRODUCT_DETAIL: 600, PRODUCT_LIST: 300, STOCK: 60 },
  CacheKey: {
    product: (id: string) => `product:${id}`,
    stock: (id: string) => `stock:${id}`,
    productListPattern: (id: string) => `products:list:${id}:1:*`,
    productListAllPattern: () => `products:list:all:1:*`,
  },
}));
jest.mock("@shared/errors", () => {
  const actual = jest.requireActual("@shared/errors");
  return { ...actual, handle: (fn: any) => fn };
});
jest.mock("../../../services/inventory-service/src/storage/rustfs", () => ({
  uploadProductImage: jest
    .fn()
    .mockResolvedValue("http://rustfs/products/prod-1/thumbnail.jpg"),
}));

import {
  createProduct,
  updateProduct,
  deleteProduct,
  getProduct,
  updateStock,
  getProductsByIds,
} from "../../../services/inventory-service/src/handlers/product.handlers";
import { writeAuditLog } from "../../../infrastructure/observability/audit";

function makeCall(request: any, meta: Record<string, string> = {}): any {
  return {
    request,
    metadata: { get: (key: string) => (meta[key] ? [meta[key]] : []) },
  };
}

function makeProduct(overrides: any = {}): any {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    category_id: "11111111-1111-4111-8111-111111111111",
    name: "T-Shirt",
    description: null,
    price: "19.99",
    stock_quantity: 10,
    thumbnail_url: null,
    list_image_url: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeCategory(): any {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Shirts",
    slug: "shirts",
  };
}

describe("createProduct", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates product and invalidates category list cache", async () => {
    const product = makeProduct();
    mockExecute
      .mockResolvedValueOnce([[makeCategory()]]) // findCategoryById
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // insert
      .mockResolvedValueOnce([[product]]); // findById

    mockCacheDelPattern.mockResolvedValue(undefined);

    const callback = jest.fn();
    await createProduct(
      makeCall(
        {
          category_id: "11111111-1111-4111-8111-111111111111",
          name: "T-Shirt",
          description: "",
          price: "19.99",
          stock_quantity: 10,
        },
        { admin_id: "a1" }
      ),
      callback
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        product: expect.objectContaining({ name: "T-Shirt" }),
      })
    );
    expect(mockCacheDelPattern).toHaveBeenCalledWith(
      "products:list:11111111-1111-4111-8111-111111111111:1:*"
    );
    expect(mockCacheDelPattern).toHaveBeenCalledWith("products:list:all:1:*");
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "create", entity_type: "product" })
    );
  });

  it("throws INVALID_ARGUMENT when required fields missing", async () => {
    const callback = jest.fn();
    await expect(
      createProduct(makeCall({ name: "T-Shirt" }), callback)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws NOT_FOUND when category does not exist", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      createProduct(
        makeCall({
          category_id: "00000000-0000-4000-8000-000000000000",
          name: "T-Shirt",
          description: "",
          price: "19.99",
          stock_quantity: 10,
        }),
        callback
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("updateProduct", () => {
  beforeEach(() => jest.clearAllMocks());

  it("updates product and invalidates caches", async () => {
    const existing = makeProduct();
    const updated = makeProduct({ name: "Updated Shirt", price: "24.99" });
    mockExecute
      .mockResolvedValueOnce([[existing]]) // findById existing
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // update
      .mockResolvedValueOnce([[updated]]); // findById after update

    mockCacheDel.mockResolvedValue(undefined);
    mockCacheDelPattern.mockResolvedValue(undefined);

    const callback = jest.fn();
    await updateProduct(
      makeCall(
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Updated Shirt",
          price: "24.99",
        },
        { admin_id: "a1" }
      ),
      callback
    );

    expect(mockCacheDel).toHaveBeenCalledWith(
      "product:22222222-2222-4222-8222-222222222222"
    );
    expect(mockCacheDelPattern).toHaveBeenCalledWith(
      "products:list:11111111-1111-4111-8111-111111111111:1:*"
    );
    expect(mockCacheDelPattern).toHaveBeenCalledWith("products:list:all:1:*");
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "update",
        metadata: expect.objectContaining({ diff: expect.any(Object) }),
      })
    );
  });

  it("throws INVALID_ARGUMENT when id missing", async () => {
    const callback = jest.fn();
    await expect(
      updateProduct(makeCall({ name: "New Name" }), callback)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws NOT_FOUND when product does not exist", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      updateProduct(
        makeCall({ id: "00000000-0000-4000-8000-000000000000", name: "X" }),
        callback
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("invalidates new category list when category changes", async () => {
    const existing = makeProduct({
      category_id: "11111111-1111-4111-8111-111111111111",
    });
    const updated = makeProduct({
      category_id: "44444444-4444-4444-8444-444444444444",
    });
    mockExecute
      .mockResolvedValueOnce([[existing]])
      .mockResolvedValueOnce([[makeCategory()]]) // findCategoryById new category
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[updated]]);

    mockCacheDel.mockResolvedValue(undefined);
    mockCacheDelPattern.mockResolvedValue(undefined);

    const callback = jest.fn();
    await updateProduct(
      makeCall(
        {
          id: "22222222-2222-4222-8222-222222222222",
          category_id: "44444444-4444-4444-8444-444444444444",
        },
        { admin_id: "a1" }
      ),
      callback
    );

    expect(mockCacheDelPattern).toHaveBeenCalledWith(
      "products:list:44444444-4444-4444-8444-444444444444:1:*"
    );
  });
});

describe("deleteProduct", () => {
  beforeEach(() => jest.clearAllMocks());

  it("soft deletes product and invalidates caches", async () => {
    const existing = makeProduct();
    mockExecute
      .mockResolvedValueOnce([[existing]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    mockCacheDel.mockResolvedValue(undefined);
    mockCacheDelPattern.mockResolvedValue(undefined);

    const callback = jest.fn();
    await deleteProduct(
      makeCall(
        { id: "22222222-2222-4222-8222-222222222222" },
        { admin_id: "a1" }
      ),
      callback
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ success: true })
    );
    expect(mockCacheDel).toHaveBeenCalledWith(
      "product:22222222-2222-4222-8222-222222222222"
    );
    expect(mockCacheDelPattern).toHaveBeenCalledWith(
      "products:list:11111111-1111-4111-8111-111111111111:1:*"
    );
    expect(mockCacheDelPattern).toHaveBeenCalledWith("products:list:all:1:*");
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "delete" })
    );
  });

  it("throws NOT_FOUND when product does not exist", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      deleteProduct(
        makeCall({ id: "00000000-0000-4000-8000-000000000000" }),
        callback
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("getProduct", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns cached product when available", async () => {
    const cached = makeProduct();
    mockCacheGet.mockResolvedValueOnce(cached);

    const callback = jest.fn();
    await getProduct(
      makeCall({ id: "22222222-2222-4222-8222-222222222222" }),
      callback
    );

    expect(callback).toHaveBeenCalledWith(null, { product: cached });
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("fetches from DB and caches on miss", async () => {
    const product = makeProduct();
    mockCacheGet.mockResolvedValueOnce(null);
    mockExecute.mockResolvedValueOnce([[product]]);
    mockCacheSet.mockResolvedValue(undefined);

    const callback = jest.fn();
    await getProduct(
      makeCall({ id: "22222222-2222-4222-8222-222222222222" }),
      callback
    );

    expect(callback).toHaveBeenCalledWith(null, { product });
    expect(mockCacheSet).toHaveBeenCalledWith(
      "product:22222222-2222-4222-8222-222222222222",
      product,
      600
    );
  });

  it("throws NOT_FOUND when product does not exist", async () => {
    mockCacheGet.mockResolvedValueOnce(null);
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      getProduct(
        makeCall({ id: "00000000-0000-4000-8000-000000000000" }),
        callback
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("updateStock", () => {
  beforeEach(() => jest.clearAllMocks());

  it("increments stock and invalidates stock cache", async () => {
    const existing = makeProduct({ stock_quantity: 10 });
    const updated = makeProduct({ stock_quantity: 15 });
    mockExecute
      .mockResolvedValueOnce([[existing]]) // findProductById (existing, for audit stock_before)
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // atomic update
      .mockResolvedValueOnce([[updated]]); // findById

    mockCacheDel.mockResolvedValue(undefined);
    mockCacheDelPattern.mockResolvedValue(undefined);

    const callback = jest.fn();
    await updateStock(
      makeCall({
        product_id: "22222222-2222-4222-8222-222222222222",
        delta: 5,
      }),
      callback
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        product_id: "22222222-2222-4222-8222-222222222222",
        stock_quantity: 15,
      })
    );
    expect(mockCacheDel).toHaveBeenCalledWith(
      "stock:22222222-2222-4222-8222-222222222222",
      "product:22222222-2222-4222-8222-222222222222"
    );
  });

  it("writes an audit log entry with delta, reason, and before/after quantities", async () => {
    const existing = makeProduct({ stock_quantity: 10 });
    const updated = makeProduct({ stock_quantity: 15 });
    mockExecute
      .mockResolvedValueOnce([[existing]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[updated]]);

    mockCacheDel.mockResolvedValue(undefined);
    mockCacheDelPattern.mockResolvedValue(undefined);

    const callback = jest.fn();
    await updateStock(
      makeCall({
        product_id: "22222222-2222-4222-8222-222222222222",
        delta: 5,
        reason: "Restock from supplier",
      }),
      callback
    );

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entity_type: "product",
        entity_id: "22222222-2222-4222-8222-222222222222",
        action: "update",
        metadata: expect.objectContaining({
          type: "stock_adjustment",
          delta: 5,
          reason: "Restock from supplier",
          stock_before: 10,
          stock_after: 15,
        }),
      })
    );
  });

  it("throws INVALID_ARGUMENT when stock would go below zero", async () => {
    const existing = makeProduct({ stock_quantity: 10 });
    mockExecute
      .mockResolvedValueOnce([[existing]]) // findProductById
      .mockResolvedValueOnce([{ affectedRows: 0 }]); // atomic update rejected

    const callback = jest.fn();
    await expect(
      updateStock(
        makeCall({
          product_id: "22222222-2222-4222-8222-222222222222",
          delta: -999,
        }),
        callback
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws INVALID_ARGUMENT when product_id missing", async () => {
    const callback = jest.fn();
    await expect(
      updateStock(makeCall({ delta: 5 }), callback)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("getProductsByIds", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns products for given ids", async () => {
    const products = [
      makeProduct(),
      makeProduct({
        id: "33333333-3333-4333-8333-333333333333",
        name: "Socks",
      }),
    ];
    mockExecute.mockResolvedValueOnce([products]);

    const callback = jest.fn();
    await getProductsByIds(
      makeCall({
        ids: [
          "22222222-2222-4222-8222-222222222222",
          "33333333-3333-4333-8333-333333333333",
        ],
      }),
      callback
    );

    expect(callback).toHaveBeenCalledWith(null, { products });
  });

  it("returns empty array when ids is empty", async () => {
    const callback = jest.fn();
    await getProductsByIds(makeCall({ ids: [] }), callback);

    expect(callback).toHaveBeenCalledWith(null, { products: [] });
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
