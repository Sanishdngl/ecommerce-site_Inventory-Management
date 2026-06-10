import { CacheKey, TTL } from "../../../shared/src/redis";

describe("CacheKey builders", () => {
  it("product key", () => {
    expect(CacheKey.product("abc")).toBe("product:abc");
  });
  it("productList key — defaults", () => {
    expect(CacheKey.productList("cat-1")).toBe("products:list:cat-1:1:20");
  });
  it("productList key — custom page and limit", () => {
    expect(CacheKey.productList("cat-1", 2, 5)).toBe("products:list:cat-1:2:5");
  });
  it("categoriesAll key", () => {
    expect(CacheKey.categoriesAll()).toBe("categories:all");
  });
  it("stock key", () => {
    expect(CacheKey.stock("prod-1")).toBe("stock:prod-1");
  });
  it("cart key", () => {
    expect(CacheKey.cart("cust-1")).toBe("cart:cust-1");
  });
});

describe("TTL values", () => {
  it("PRODUCT_DETAIL is 10 minutes", () => {
    expect(TTL.PRODUCT_DETAIL).toBe(600);
  });
  it("PRODUCT_LIST is 5 minutes", () => {
    expect(TTL.PRODUCT_LIST).toBe(300);
  });
  it("CATEGORIES_ALL is 30 minutes", () => {
    expect(TTL.CATEGORIES_ALL).toBe(1800);
  });
  it("STOCK is 1 minute", () => {
    expect(TTL.STOCK).toBe(60);
  });
  it("CART is 24 hours", () => {
    expect(TTL.CART).toBe(86400);
  });
});
