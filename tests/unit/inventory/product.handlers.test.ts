import * as grpc from "@grpc/grpc-js";

const mockExecute = jest.fn();
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheDel = jest.fn();

jest.mock("@shared/db", () => ({ getDb: () => ({ execute: mockExecute }) }));
jest.mock("@shared/audit", () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@shared/redis", () => ({
  cacheGet: (...args: any[]) => mockCacheGet(...args),
  cacheSet: (...args: any[]) => mockCacheSet(...args),
  cacheDel: (...args: any[]) => mockCacheDel(...args),
  TTL: { PRODUCT_DETAIL: 600, PRODUCT_LIST: 300, STOCK: 60 },
  CacheKey: {
    product: (id: string) => `product:${id}`,
    productList: (id: string) => `products:list:${id}`,
    stock: (id: string) => `stock:${id}`,
  },
}));
jest.mock("@shared/errors", () => {
  const actual = jest.requireActual("@shared/errors");
  return { ...actual, handle: (fn: any) => fn };
});
jest.mock(
  "../../../services/inventory-service/src/storage/rustfs.client",
  () => ({
    uploadProductImage: jest
      .fn()
      .mockResolvedValue("http://rustfs/products/prod-1/thumbnail.jpg"),
  })
);

import {
  createProduct,
  updateProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateStock,
  getProductsByIds,
} from "../../../services/inventory-service/src/handlers/product.handlers";
import { writeAuditLog } from "@shared/audit";

function makeCall(request: any, meta: Record<string, string> = {}): any {
  return {
    request,
    metadata: { get: (key: string) => (meta[key] ? [meta[key]] : []) },
  };
}

function makeProduct(overrides: any = {}): any {
  return {
    id: "prod-1",
    category_id: "cat-1",
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
  return { id: "cat-1", name: "Shirts", slug: "shirts" };
}

describe("createProduct", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates product and invalidates category list cache", async () => {
    const product = makeProduct();
    mockExecute
      .mockResolvedValueOnce([[makeCategory()]]) // findCategoryById
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // insert
      .mockResolvedValueOnce([[product]]); // findById

    mockCacheDel.mockResolvedValue(undefined);

    const callback = jest.fn();
    await createProduct(
      makeCall(
        {
          category_id: "cat-1",
          name: "T-Shirt",
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
    expect(mockCacheDel).toHaveBeenCalledWith("products:list:cat-1");
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "create", entity_type: "product" })
    );
  });

  it("throws INVALID_ARGUMENT when required fields missing", async () => {
    const callback = jest.fn();
    await expect(
      createProduct(makeCall({ name: "T-Shirt" }), callback)
    ).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
  });

  it("throws NOT_FOUND when category does not exist", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      createProduct(
        makeCall({ category_id: "ghost", name: "T-Shirt", price: "19.99" }),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.NOT_FOUND });
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

    const callback = jest.fn();
    await updateProduct(
      makeCall(
        { id: "prod-1", name: "Updated Shirt", price: "24.99" },
        { admin_id: "a1" }
      ),
      callback
    );

    expect(mockCacheDel).toHaveBeenCalledWith(
      "product:prod-1",
      "products:list:cat-1"
    );
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
    ).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
  });

  it("throws NOT_FOUND when product does not exist", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      updateProduct(makeCall({ id: "ghost", name: "X" }), callback)
    ).rejects.toMatchObject({ code: grpc.status.NOT_FOUND });
  });

  it("invalidates new category list when category changes", async () => {
    const existing = makeProduct({ category_id: "cat-1" });
    const updated = makeProduct({ category_id: "cat-2" });
    mockExecute
      .mockResolvedValueOnce([[existing]])
      .mockResolvedValueOnce([[makeCategory()]]) // findCategoryById new category
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[updated]]);

    mockCacheDel.mockResolvedValue(undefined);

    const callback = jest.fn();
    await updateProduct(
      makeCall({ id: "prod-1", category_id: "cat-2" }, { admin_id: "a1" }),
      callback
    );

    expect(mockCacheDel).toHaveBeenCalledWith("products:list:cat-2");
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

    const callback = jest.fn();
    await deleteProduct(
      makeCall({ id: "prod-1" }, { admin_id: "a1" }),
      callback
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ success: true })
    );
    expect(mockCacheDel).toHaveBeenCalledWith(
      "product:prod-1",
      "products:list:cat-1"
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "delete" })
    );
  });

  it("throws NOT_FOUND when product does not exist", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      deleteProduct(makeCall({ id: "ghost" }), callback)
    ).rejects.toMatchObject({ code: grpc.status.NOT_FOUND });
  });
});

describe("getProduct", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns cached product when available", async () => {
    const cached = makeProduct();
    mockCacheGet.mockResolvedValueOnce(cached);

    const callback = jest.fn();
    await getProduct(makeCall({ id: "prod-1" }), callback);

    expect(callback).toHaveBeenCalledWith(null, { product: cached });
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("fetches from DB and caches on miss", async () => {
    const product = makeProduct();
    mockCacheGet.mockResolvedValueOnce(null);
    mockExecute.mockResolvedValueOnce([[product]]);
    mockCacheSet.mockResolvedValue(undefined);

    const callback = jest.fn();
    await getProduct(makeCall({ id: "prod-1" }), callback);

    expect(callback).toHaveBeenCalledWith(null, { product });
    expect(mockCacheSet).toHaveBeenCalledWith("product:prod-1", product, 600);
  });

  it("throws NOT_FOUND when product does not exist", async () => {
    mockCacheGet.mockResolvedValueOnce(null);
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      getProduct(makeCall({ id: "ghost" }), callback)
    ).rejects.toMatchObject({ code: grpc.status.NOT_FOUND });
  });
});

describe("updateStock", () => {
  beforeEach(() => jest.clearAllMocks());

  it("increments stock and invalidates stock cache", async () => {
    const updated = makeProduct({ stock_quantity: 15 });
    mockExecute
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // atomic update
      .mockResolvedValueOnce([[updated]]); // findById

    mockCacheDel.mockResolvedValue(undefined);

    const callback = jest.fn();
    await updateStock(makeCall({ product_id: "prod-1", delta: 5 }), callback);

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        product_id: "prod-1",
        stock_quantity: 15,
      })
    );
    expect(mockCacheDel).toHaveBeenCalledWith("stock:prod-1");
  });

  it("throws INVALID_ARGUMENT when stock would go below zero", async () => {
    mockExecute.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const callback = jest.fn();
    await expect(
      updateStock(makeCall({ product_id: "prod-1", delta: -999 }), callback)
    ).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
  });

  it("throws INVALID_ARGUMENT when product_id missing", async () => {
    const callback = jest.fn();
    await expect(
      updateStock(makeCall({ delta: 5 }), callback)
    ).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
  });
});

describe("getProductsByIds", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns products for given ids", async () => {
    const products = [
      makeProduct(),
      makeProduct({ id: "prod-2", name: "Socks" }),
    ];
    mockExecute.mockResolvedValueOnce([products]);

    const callback = jest.fn();
    await getProductsByIds(makeCall({ ids: ["prod-1", "prod-2"] }), callback);

    expect(callback).toHaveBeenCalledWith(null, { products });
  });

  it("returns empty array when ids is empty", async () => {
    const callback = jest.fn();
    await getProductsByIds(makeCall({ ids: [] }), callback);

    expect(callback).toHaveBeenCalledWith(null, { products: [] });
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
