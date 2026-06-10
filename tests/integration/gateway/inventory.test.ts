import request from "supertest";
import app from "../../../gateway/src/app";
import { loginAsSuperAdmin, adminAuthHeader } from "../helpers/auth";
import { deleteCategoryBySlug, deleteProductByName } from "../helpers/cleanup";

let superAdminToken: string;
let createdCategoryId: string;
let createdProductId: string;

const TEST_SLUG = `test-category-${Date.now()}`;
const TEST_PRODUCT_NAME = `Test Product ${Date.now()}`;

beforeAll(async () => {
  const { token } = await loginAsSuperAdmin();
  superAdminToken = token;
});

afterAll(async () => {
  await deleteProductByName(TEST_PRODUCT_NAME);
  await deleteCategoryBySlug(TEST_SLUG);
});

describe("POST /api/admin/inventory/categories", () => {
  it("creates a category", async () => {
    const res = await request(app)
      .post("/api/admin/inventory/categories")
      .set(adminAuthHeader(superAdminToken))
      .send({ name: `Test Category ${Date.now()}`, slug: TEST_SLUG });

    expect(res.status).toBe(201);
    expect(res.body.category).toBeDefined();
    expect(res.body.category.slug).toBe(TEST_SLUG);

    createdCategoryId = res.body.category.id;
  });

  it("returns 409 on duplicate slug", async () => {
    const res = await request(app)
      .post("/api/admin/inventory/categories")
      .set(adminAuthHeader(superAdminToken))
      .send({ name: "Duplicate", slug: TEST_SLUG });

    expect(res.status).toBe(409);
  });

  it("returns 401 without token", async () => {
    const res = await request(app)
      .post("/api/admin/inventory/categories")
      .send({ name: "X", slug: "x" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin/inventory/categories", () => {
  it("returns category list", async () => {
    const res = await request(app)
      .get("/api/admin/inventory/categories")
      .set(adminAuthHeader(superAdminToken));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categories)).toBe(true);
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/admin/inventory/categories");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/admin/inventory/products", () => {
  it("creates a product in the test category", async () => {
    const res = await request(app)
      .post("/api/admin/inventory/products")
      .set(adminAuthHeader(superAdminToken))
      .send({
        category_id: createdCategoryId,
        name: TEST_PRODUCT_NAME,
        description: "Integration test product",
        price: "29.99",
        stock_quantity: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body.product).toBeDefined();
    expect(res.body.product.name).toBe(TEST_PRODUCT_NAME);
    expect(res.body.product.price).toBe("29.99");

    createdProductId = res.body.product.id;
  });

  it("returns 404 for non-existent category", async () => {
    const res = await request(app)
      .post("/api/admin/inventory/products")
      .set(adminAuthHeader(superAdminToken))
      .send({
        category_id: "00000000-0000-0000-0000-000000000000",
        name: "Ghost Product",
        price: "9.99",
        stock_quantity: 0,
      });

    expect(res.status).toBe(404);
  });

  it("returns 400 when required fields missing", async () => {
    const res = await request(app)
      .post("/api/admin/inventory/products")
      .set(adminAuthHeader(superAdminToken))
      .send({ name: "Incomplete" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/admin/inventory/products", () => {
  it("returns product list for category", async () => {
    const res = await request(app)
      .get(`/api/admin/inventory/products?category_id=${createdCategoryId}`)
      .set(adminAuthHeader(superAdminToken));

    expect(res.status).toBe(200);
    expect(res.body.products).toBeDefined();
    expect(Array.isArray(res.body.products)).toBe(true);
  });
});

describe("GET /api/admin/inventory/products/:id", () => {
  it("returns a specific product", async () => {
    const res = await request(app)
      .get(`/api/admin/inventory/products/${createdProductId}`)
      .set(adminAuthHeader(superAdminToken));

    expect(res.status).toBe(200);
    expect(res.body.product.id).toBe(createdProductId);
  });

  it("returns 404 for non-existent product", async () => {
    const res = await request(app)
      .get("/api/admin/inventory/products/00000000-0000-0000-0000-000000000000")
      .set(adminAuthHeader(superAdminToken));

    expect(res.status).toBe(404);
  });
});

describe("PUT /api/admin/inventory/products/:id", () => {
  it("updates product price and description", async () => {
    const res = await request(app)
      .put(`/api/admin/inventory/products/${createdProductId}`)
      .set(adminAuthHeader(superAdminToken))
      .send({ price: "39.99", description: "Updated description" });

    expect(res.status).toBe(200);
    expect(res.body.product.price).toBe("39.99");
  });
});

describe("PATCH /api/admin/inventory/products/:id/stock", () => {
  it("increments stock", async () => {
    const res = await request(app)
      .patch(`/api/admin/inventory/products/${createdProductId}/stock`)
      .set(adminAuthHeader(superAdminToken))
      .send({ delta: 10 });

    expect(res.status).toBe(200);
    expect(res.body.stock_quantity).toBe(110);
  });

  it("rejects stock decrement below zero", async () => {
    const res = await request(app)
      .patch(`/api/admin/inventory/products/${createdProductId}/stock`)
      .set(adminAuthHeader(superAdminToken))
      .send({ delta: -99999 });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/inventory/products/:id", () => {
  it("soft deletes the product", async () => {
    const res = await request(app)
      .delete(`/api/admin/inventory/products/${createdProductId}`)
      .set(adminAuthHeader(superAdminToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns 404 for already deleted product", async () => {
    const res = await request(app)
      .delete(`/api/admin/inventory/products/${createdProductId}`)
      .set(adminAuthHeader(superAdminToken));

    expect(res.status).toBe(404);
  });
});

describe("Role enforcement on inventory routes", () => {
  let reporterToken: string;
  let reporterUserId: string;

  beforeAll(async () => {
    const createRes = await request(app)
      .post("/api/admin/users")
      .set(adminAuthHeader(superAdminToken))
      .send({
        username: `reporter_${Date.now()}`,
        email: `reporter_${Date.now()}@test.com`,
        password: "testpassword123",
        role: "reporter",
      });

    reporterUserId = createRes.body.user.id;

    const loginRes = await request(app).post("/api/admin/auth/login").send({
      username: createRes.body.user.username,
      password: "testpassword123",
    });

    reporterToken = loginRes.body.token;
  });

  afterAll(async () => {
    await request(app)
      .delete(`/api/admin/users/${reporterUserId}`)
      .set(adminAuthHeader(superAdminToken));
  });

  it("reporter cannot create a category", async () => {
    const res = await request(app)
      .post("/api/admin/inventory/categories")
      .set(adminAuthHeader(reporterToken))
      .send({ name: "Forbidden", slug: "forbidden" });

    expect(res.status).toBe(403);
  });

  it("reporter cannot create a product", async () => {
    const res = await request(app)
      .post("/api/admin/inventory/products")
      .set(adminAuthHeader(reporterToken))
      .send({
        category_id: createdCategoryId,
        name: "X",
        price: "1.00",
        stock_quantity: 0,
      });

    expect(res.status).toBe(403);
  });

  it("reporter can read categories", async () => {
    const res = await request(app)
      .get("/api/admin/inventory/categories")
      .set(adminAuthHeader(reporterToken));

    expect(res.status).toBe(200);
  });
});
