import request from "supertest";
import app from "../../../gateway/src/app";
import { loginAsSuperAdmin, adminAuthHeader } from "../helpers/auth";
import { deleteCategoryBySlug, deleteProductByName } from "../helpers/cleanup";

let categorySlug: string;
let productId: string;

beforeAll(async () => {
  const { token } = await loginAsSuperAdmin();

  categorySlug = `public-test-${Date.now()}`;

  const catRes = await request(app)
    .post("/api/admin/inventory/categories")
    .set(adminAuthHeader(token))
    .send({ name: `Public Test Category ${Date.now()}`, slug: categorySlug });

  const catId = catRes.body.category.id;

  const prodRes = await request(app)
    .post("/api/admin/inventory/products")
    .set(adminAuthHeader(token))
    .send({
      category_id: catId,
      name: `Public Test Product ${Date.now()}`,
      price: "19.99",
      stock_quantity: 50,
    });

  productId = prodRes.body.product.id;
});

afterAll(async () => {
  await deleteProductByName(`Public Test Product`);
  await deleteCategoryBySlug(categorySlug);
});

describe("GET /api/categories", () => {
  it("returns categories without auth", async () => {
    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categories)).toBe(true);
  });

  it("includes the seeded test category", async () => {
    const res = await request(app).get("/api/categories");
    const slugs = res.body.categories.map((c: any) => c.slug);
    expect(slugs).toContain(categorySlug);
  });
});

describe("GET /api/products", () => {
  it("returns products for a valid category slug", async () => {
    const res = await request(app).get(
      `/api/products?category=${categorySlug}`
    );

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.products.length).toBeGreaterThan(0);
  });

  it("returns 400 when category slug is missing", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent category slug", async () => {
    const res = await request(app).get("/api/products?category=does-not-exist");
    expect(res.status).toBe(404);
  });

  it("supports pagination", async () => {
    const res = await request(app).get(
      `/api/products?category=${categorySlug}&page=1&limit=5`
    );

    expect(res.status).toBe(200);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(5);
  });
});

describe("GET /api/products/:id", () => {
  it("returns a specific product", async () => {
    const res = await request(app).get(`/api/products/${productId}`);

    expect(res.status).toBe(200);
    expect(res.body.product.id).toBe(productId);
    expect(res.body.product.price).toBe("19.99");
  });

  it("returns 404 for non-existent product", async () => {
    const res = await request(app).get(
      "/api/products/00000000-0000-0000-0000-000000000000"
    );

    expect(res.status).toBe(404);
  });
});
