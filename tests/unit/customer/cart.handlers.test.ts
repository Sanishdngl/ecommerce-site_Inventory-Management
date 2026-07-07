const mockExecute = jest.fn();
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheDel = jest.fn();
const mockCallInventory = jest.fn();

jest.mock("@infrastructure/database/mysql", () => ({
  getDb: () => ({ execute: mockExecute }),
}));
jest.mock("@infrastructure/redis/redis", () => ({
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
// mock callGrpc directly rather than inventing a callInventory helper that
// doesn't exist. getInventoryClient is stubbed to avoid loading real protos.
jest.mock("@shared/grpc/call-grpc", () => ({
  callGrpc: (...args: any[]) => mockCallInventory(...args),
}));
jest.mock("@shared/grpc/inventory.client", () => ({
  getInventoryClient: () => ({}),
}));

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
    id: "22222222-2222-4222-8222-222222222222",
    name: "T-Shirt",
    price: "19.99",
    thumbnail_url: null,
    stock_quantity: 10,
  },
];

describe("addToCart", () => {
  beforeEach(() => jest.resetAllMocks());

  it("adds item to cart and returns enriched cart", async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: "11111111-1111-4111-8111-111111111111", is_active: true }]]) // findCustomer
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // upsert
      .mockResolvedValueOnce([[{ product_id: "22222222-2222-4222-8222-222222222222", quantity: 2 }]]); // getRawCartItems

    mockCallInventory.mockResolvedValueOnce({ products: mockProducts });
    mockCacheDel.mockResolvedValue(undefined);
    mockCacheSet.mockResolvedValue(undefined);

    const callback = jest.fn();
    await addToCart(
      makeCall({ customer_id: "11111111-1111-4111-8111-111111111111", product_id: "22222222-2222-4222-8222-222222222222", quantity: 2 }),
      callback
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ product_id: "22222222-2222-4222-8222-222222222222", quantity: 2 }),
        ]),
      })
    );
    expect(mockCacheDel).toHaveBeenCalledWith("cart:11111111-1111-4111-8111-111111111111");
    expect(mockCallInventory).toHaveBeenCalledWith(
      expect.anything(),
      "GetProductsByIds",
      {
        ids: ["22222222-2222-4222-8222-222222222222"],
      }
    );
  });

  it("throws INVALID_ARGUMENT when customer_id missing", async () => {
    const callback = jest.fn();
    await expect(
      addToCart(makeCall({ product_id: "22222222-2222-4222-8222-222222222222", quantity: 1 }), callback)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws INVALID_ARGUMENT when quantity is zero", async () => {
    const callback = jest.fn();
    await expect(
      addToCart(
        makeCall({ customer_id: "11111111-1111-4111-8111-111111111111", product_id: "22222222-2222-4222-8222-222222222222", quantity: 0 }),
        callback
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws INVALID_ARGUMENT when quantity is negative", async () => {
    const callback = jest.fn();
    await expect(
      addToCart(
        makeCall({ customer_id: "11111111-1111-4111-8111-111111111111", product_id: "22222222-2222-4222-8222-222222222222", quantity: -1 }),
        callback
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws NOT_FOUND when customer does not exist", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      addToCart(
        makeCall({ customer_id: "00000000-0000-4000-8000-000000000000", product_id: "22222222-2222-4222-8222-222222222222", quantity: 1 }),
        callback
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("updateCartItem", () => {
  beforeEach(() => jest.resetAllMocks());

  it("updates quantity and returns enriched cart", async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: "cart-item-1" }]]) // cartItemExists
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // setQuantity
      .mockResolvedValueOnce([[{ product_id: "22222222-2222-4222-8222-222222222222", quantity: 5 }]]); // getRawCartItems

    mockCallInventory.mockResolvedValueOnce({ products: mockProducts });
    mockCacheDel.mockResolvedValue(undefined);
    mockCacheSet.mockResolvedValue(undefined);

    const callback = jest.fn();
    await updateCartItem(
      makeCall({ customer_id: "11111111-1111-4111-8111-111111111111", product_id: "22222222-2222-4222-8222-222222222222", quantity: 5 }),
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
        makeCall({ customer_id: "11111111-1111-4111-8111-111111111111", product_id: "22222222-2222-4222-8222-222222222222", quantity: 0 }),
        callback
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws NOT_FOUND when cart item does not exist", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      updateCartItem(
        makeCall({ customer_id: "11111111-1111-4111-8111-111111111111", product_id: "22222222-2222-4222-8222-222222222222", quantity: 3 }),
        callback
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("removeFromCart", () => {
  beforeEach(() => jest.resetAllMocks());

  it("removes item and returns updated cart", async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: "cart-item-1" }]]) // cartItemExists
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // delete
      .mockResolvedValueOnce([[]]); // getRawCartItems — empty

    mockCacheDel.mockResolvedValue(undefined);
    mockCacheSet.mockResolvedValue(undefined);

    const callback = jest.fn();
    await removeFromCart(
      makeCall({ customer_id: "11111111-1111-4111-8111-111111111111", product_id: "22222222-2222-4222-8222-222222222222" }),
      callback
    );

    expect(callback).toHaveBeenCalledWith(null, { items: [] });
    expect(mockCacheDel).toHaveBeenCalledWith("cart:11111111-1111-4111-8111-111111111111");
  });

  it("throws INVALID_ARGUMENT when fields missing", async () => {
    const callback = jest.fn();
    await expect(removeFromCart(makeCall({}), callback)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("throws NOT_FOUND when cart item does not exist", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      removeFromCart(
        makeCall({ customer_id: "11111111-1111-4111-8111-111111111111", product_id: "22222222-2222-4222-8222-222222222222" }),
        callback
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("getCart", () => {
  beforeEach(() => jest.resetAllMocks());

  it("returns cached cart when available", async () => {
    const cached = [
      {
        product_id: "22222222-2222-4222-8222-222222222222",
        quantity: 1,
        product_name: "T-Shirt",
        price: "19.99",
        thumbnail_url: null,
        stock_quantity: 10,
      },
    ];
    mockCacheGet.mockResolvedValueOnce(cached);

    const callback = jest.fn();
    await getCart(makeCall({ customer_id: "11111111-1111-4111-8111-111111111111" }), callback);

    expect(callback).toHaveBeenCalledWith(null, { items: cached });
    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockCallInventory).not.toHaveBeenCalled();
  });

  it("fetches from DB and enriches via gRPC on cache miss", async () => {
    mockCacheGet.mockResolvedValueOnce(null);
    mockExecute.mockResolvedValueOnce([
      [{ product_id: "22222222-2222-4222-8222-222222222222", quantity: 2 }],
    ]);
    mockCallInventory.mockResolvedValueOnce({ products: mockProducts });
    mockCacheSet.mockResolvedValue(undefined);

    const callback = jest.fn();
    await getCart(makeCall({ customer_id: "11111111-1111-4111-8111-111111111111" }), callback);

    expect(mockCallInventory).toHaveBeenCalledWith(
      expect.anything(),
      "GetProductsByIds",
      {
        ids: ["22222222-2222-4222-8222-222222222222"],
      }
    );
    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ product_id: "22222222-2222-4222-8222-222222222222" }),
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
    await getCart(makeCall({ customer_id: "11111111-1111-4111-8111-111111111111" }), callback);

    expect(callback).toHaveBeenCalledWith(null, { items: [] });
    expect(mockCallInventory).not.toHaveBeenCalled();
  });

  it("throws INVALID_ARGUMENT when customer_id missing", async () => {
    const callback = jest.fn();
    await expect(getCart(makeCall({}), callback)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
