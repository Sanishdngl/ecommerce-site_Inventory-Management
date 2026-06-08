import * as grpc from "@grpc/grpc-js";

const mockExecute = jest.fn();
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheDel = jest.fn();
const mockCallInventory = jest.fn();

jest.mock("@shared/db", () => ({ getDb: () => ({ execute: mockExecute }) }));
jest.mock("@shared/redis", () => ({
  cacheGet: (...args: any[]) => mockCacheGet(...args),
  cacheSet: (...args: any[]) => mockCacheSet(...args),
  cacheDel: (...args: any[]) => mockCacheDel(...args),
  TTL: { CART: 86400 },
  CacheKey: { cart: (id: string) => `cart:${id}` },
}));
jest.mock("@shared/errors", () => {
  const actual = jest.requireActual("@shared/errors");
  return { ...actual, handle: (fn: any) => fn };
});
jest.mock(
  "../../../services/customer-service/src/grpc-clients/inventory.client",
  () => ({
    callInventory: (...args: any[]) => mockCallInventory(...args),
  })
);

import {
  addToCart,
  updateCartItem,
  removeFromCart,
  getCart,
} from "../../../services/customer-service/src/handlers/cart.handlers";

function makeCall(request: any): any {
  return { request, metadata: { get: () => [] } };
}

const mockProducts = [
  {
    id: "prod-1",
    name: "T-Shirt",
    price: "19.99",
    thumbnail_url: null,
    stock_quantity: 10,
  },
];

describe("addToCart", () => {
  beforeEach(() => jest.clearAllMocks());

  it("adds item to cart and returns enriched cart", async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: "cust-1", is_active: true }]]) // findCustomer
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // upsert
      .mockResolvedValueOnce([[{ product_id: "prod-1", quantity: 2 }]]); // getRawCartItems

    mockCallInventory.mockResolvedValueOnce({ products: mockProducts });
    mockCacheDel.mockResolvedValue(undefined);
    mockCacheSet.mockResolvedValue(undefined);

    const callback = jest.fn();
    await addToCart(
      makeCall({ customer_id: "cust-1", product_id: "prod-1", quantity: 2 }),
      callback
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ product_id: "prod-1", quantity: 2 }),
        ]),
      })
    );
    expect(mockCacheDel).toHaveBeenCalledWith("cart:cust-1");
    expect(mockCallInventory).toHaveBeenCalledWith("GetProductsByIds", {
      ids: ["prod-1"],
    });
  });

  it("throws INVALID_ARGUMENT when customer_id missing", async () => {
    const callback = jest.fn();
    await expect(
      addToCart(makeCall({ product_id: "prod-1", quantity: 1 }), callback)
    ).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
  });

  it("throws INVALID_ARGUMENT when quantity is zero", async () => {
    const callback = jest.fn();
    await expect(
      addToCart(
        makeCall({ customer_id: "cust-1", product_id: "prod-1", quantity: 0 }),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
  });

  it("throws INVALID_ARGUMENT when quantity is negative", async () => {
    const callback = jest.fn();
    await expect(
      addToCart(
        makeCall({ customer_id: "cust-1", product_id: "prod-1", quantity: -1 }),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
  });

  it("throws NOT_FOUND when customer does not exist", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      addToCart(
        makeCall({ customer_id: "ghost", product_id: "prod-1", quantity: 1 }),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.NOT_FOUND });
  });
});

describe("updateCartItem", () => {
  beforeEach(() => jest.clearAllMocks());

  it("updates quantity and returns enriched cart", async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: "cart-item-1" }]]) // cartItemExists
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // setQuantity
      .mockResolvedValueOnce([[{ product_id: "prod-1", quantity: 5 }]]); // getRawCartItems

    mockCallInventory.mockResolvedValueOnce({ products: mockProducts });
    mockCacheDel.mockResolvedValue(undefined);
    mockCacheSet.mockResolvedValue(undefined);

    const callback = jest.fn();
    await updateCartItem(
      makeCall({ customer_id: "cust-1", product_id: "prod-1", quantity: 5 }),
      callback
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ quantity: 5 }),
        ]),
      })
    );
  });

  it("throws INVALID_ARGUMENT when quantity is zero", async () => {
    const callback = jest.fn();
    await expect(
      updateCartItem(
        makeCall({ customer_id: "cust-1", product_id: "prod-1", quantity: 0 }),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
  });

  it("throws NOT_FOUND when cart item does not exist", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      updateCartItem(
        makeCall({ customer_id: "cust-1", product_id: "prod-1", quantity: 3 }),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.NOT_FOUND });
  });
});

describe("removeFromCart", () => {
  beforeEach(() => jest.clearAllMocks());

  it("removes item and returns updated cart", async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: "cart-item-1" }]]) // cartItemExists
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // delete
      .mockResolvedValueOnce([[]]); // getRawCartItems — empty

    mockCallInventory.mockResolvedValueOnce({ products: [] });
    mockCacheDel.mockResolvedValue(undefined);
    mockCacheSet.mockResolvedValue(undefined);

    const callback = jest.fn();
    await removeFromCart(
      makeCall({ customer_id: "cust-1", product_id: "prod-1" }),
      callback
    );

    expect(callback).toHaveBeenCalledWith(null, { items: [] });
    expect(mockCacheDel).toHaveBeenCalledWith("cart:cust-1");
  });

  it("throws INVALID_ARGUMENT when fields missing", async () => {
    const callback = jest.fn();
    await expect(removeFromCart(makeCall({}), callback)).rejects.toMatchObject({
      code: grpc.status.INVALID_ARGUMENT,
    });
  });

  it("throws NOT_FOUND when cart item does not exist", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      removeFromCart(
        makeCall({ customer_id: "cust-1", product_id: "prod-1" }),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.NOT_FOUND });
  });
});

describe("getCart", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns cached cart when available", async () => {
    const cached = [
      {
        product_id: "prod-1",
        quantity: 1,
        product_name: "T-Shirt",
        price: "19.99",
        thumbnail_url: null,
        stock_quantity: 10,
      },
    ];
    mockCacheGet.mockResolvedValueOnce(cached);

    const callback = jest.fn();
    await getCart(makeCall({ customer_id: "cust-1" }), callback);

    expect(callback).toHaveBeenCalledWith(null, { items: cached });
    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockCallInventory).not.toHaveBeenCalled();
  });

  it("fetches from DB and enriches via gRPC on cache miss", async () => {
    mockCacheGet.mockResolvedValueOnce(null);
    mockExecute.mockResolvedValueOnce([
      [{ product_id: "prod-1", quantity: 2 }],
    ]);
    mockCallInventory.mockResolvedValueOnce({ products: mockProducts });
    mockCacheSet.mockResolvedValue(undefined);

    const callback = jest.fn();
    await getCart(makeCall({ customer_id: "cust-1" }), callback);

    expect(mockCallInventory).toHaveBeenCalledWith("GetProductsByIds", {
      ids: ["prod-1"],
    });
    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ product_id: "prod-1" }),
        ]),
      })
    );
    expect(mockCacheSet).toHaveBeenCalled();
  });

  it("returns empty cart when no items", async () => {
    mockCacheGet.mockResolvedValueOnce(null);
    mockExecute.mockResolvedValueOnce([[]]);
    mockCacheSet.mockResolvedValue(undefined);

    const callback = jest.fn();
    await getCart(makeCall({ customer_id: "cust-1" }), callback);

    expect(callback).toHaveBeenCalledWith(null, { items: [] });
    expect(mockCallInventory).not.toHaveBeenCalled();
  });

  it("throws INVALID_ARGUMENT when customer_id missing", async () => {
    const callback = jest.fn();
    await expect(getCart(makeCall({}), callback)).rejects.toMatchObject({
      code: grpc.status.INVALID_ARGUMENT,
    });
  });
});
