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
  TTL: { CATEGORIES_ALL: 1800 },
  CacheKey: { categoriesAll: () => "categories:all" },
}));
jest.mock("@shared/errors", () => {
  const actual = jest.requireActual("@shared/errors");
  return { ...actual, handle: (fn: any) => fn };
});

import {
  createCategory,
  listCategories,
} from "../../../services/inventory-service/src/handlers/category.handlers";

function makeCall(request: any, meta: Record<string, string> = {}): any {
  return {
    request,
    metadata: { get: (key: string) => (meta[key] ? [meta[key]] : []) },
  };
}

describe("createCategory", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates category and invalidates cache", async () => {
    const category = {
      id: "cat-1",
      name: "Shirts",
      slug: "shirts",
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockExecute
      .mockResolvedValueOnce([[]]) // findBySlug — not found
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // insert
      .mockResolvedValueOnce([[category]]); // findById

    mockCacheDel.mockResolvedValue(undefined);

    const callback = jest.fn();
    await createCategory(
      makeCall({ name: "Shirts", slug: "shirts" }, { admin_id: "a1" }),
      callback
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        category: expect.objectContaining({ slug: "shirts" }),
      })
    );
    expect(mockCacheDel).toHaveBeenCalledWith("categories:all");
  });

  it("throws INVALID_ARGUMENT when fields missing", async () => {
    const callback = jest.fn();
    await expect(
      createCategory(makeCall({ name: "", slug: "" }), callback)
    ).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
  });

  it("throws ALREADY_EXISTS on duplicate slug", async () => {
    mockExecute.mockResolvedValueOnce([[{ id: "cat-1", slug: "shirts" }]]);

    const callback = jest.fn();
    await expect(
      createCategory(makeCall({ name: "Shirts", slug: "shirts" }), callback)
    ).rejects.toMatchObject({ code: grpc.status.ALREADY_EXISTS });
  });
});

describe("listCategories", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns cached categories when available", async () => {
    const cached = [{ id: "cat-1", name: "Shirts", slug: "shirts" }];
    mockCacheGet.mockResolvedValueOnce(cached);

    const callback = jest.fn();
    await listCategories(makeCall({}), callback);

    expect(callback).toHaveBeenCalledWith(null, { categories: cached });
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("fetches from DB and caches on miss", async () => {
    const categories = [{ id: "cat-1", name: "Shirts", slug: "shirts" }];
    mockCacheGet.mockResolvedValueOnce(null);
    mockExecute.mockResolvedValueOnce([categories]);
    mockCacheSet.mockResolvedValue(undefined);

    const callback = jest.fn();
    await listCategories(makeCall({}), callback);

    expect(callback).toHaveBeenCalledWith(null, { categories });
    expect(mockCacheSet).toHaveBeenCalledWith(
      "categories:all",
      categories,
      1800
    );
  });
});
