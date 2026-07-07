import request from "supertest";
import app from "../../../gateway/src/app";
import {
  registerAndLoginCustomer,
  customerAuthHeader,
  loginAsSuperAdmin,
  adminAuthHeader,
} from "../helpers/auth";
import {
  deleteCustomerByEmail,
  deleteCategoryById,
  deleteProductById,
} from "../helpers/cleanup";

let customerToken: string;
let customerEmail: string;
let productId: string;
let categoryId: string;

beforeAll(async () => {
  const { token: adminToken } = await loginAsSuperAdmin();
  const categorySlug = `cart-test-${Date.now()}`;

  const catRes = await request(app)
    .post("/api/admin/inventory/categories")
    .set(adminAuthHeader(adminToken))
    .send({ name: `Cart Test Category ${Date.now()}`, slug: categorySlug });

  categoryId = catRes.body.category.id;

  const prodRes = await request(app)
    .post("/api/admin/inventory/products")
    .set(adminAuthHeader(adminToken))
    .send({
      category_id: categoryId,
      name: `Cart Test Product ${Date.now()}`,
      price: "15.00",
      stock_quantity: 50,
    });

  productId = prodRes.body.product.id;

  customerEmail = `cart_test_${Date.now()}@example.com`;
  const { token } = await registerAndLoginCustomer(customerEmail);
  customerToken = token;
});

afterAll(async () => {
  await deleteCustomerByEmail(customerEmail);
  await deleteProductById(productId);
  await deleteCategoryById(categoryId);
});

describe("POST /api/customer/auth/register", () => {
  const email = `reg_test_${Date.now()}@example.com`;

  afterAll(() => deleteCustomerByEmail(email));

  it("registers a new customer", async () => {
    const res = await request(app).post("/api/customer/auth/register").send({
      email,
      password: "password123",
      first_name: "Test",
      last_name: "User",
      device_id: "integration-test-device",
      device_pixel_ratio: 1,
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.customer.email).toBe(email);
    expect(res.body.customer.password_hash).toBeUndefined();
  });

  it("returns 409 on duplicate email", async () => {
    const res = await request(app).post("/api/customer/auth/register").send({
      email,
      password: "password123",
      first_name: "A",
      last_name: "B",
      device_id: "integration-test-device",
      device_pixel_ratio: 1,
    });

    expect(res.status).toBe(409);
  });

  it("returns 400 when password under 8 characters", async () => {
    const res = await request(app)
      .post("/api/customer/auth/register")
      .send({
        email: `x_${Date.now()}@x.com`,
        password: "short",
        first_name: "A",
        last_name: "B",
        device_id: "integration-test-device",
        device_pixel_ratio: 1,
      });

    expect(res.status).toBe(400);
  });

  it("returns 400 when device_id missing", async () => {
    const res = await request(app)
      .post("/api/customer/auth/register")
      .send({
        email: `x_${Date.now()}@x.com`,
        password: "password123",
        first_name: "A",
        last_name: "B",
        device_pixel_ratio: 1,
      });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/customer/auth/login", () => {
  it("logs in with valid credentials", async () => {
    const res = await request(app).post("/api/customer/auth/login").send({
      email: customerEmail,
      password: "testpassword123",
      device_id: "integration-test-device",
      device_pixel_ratio: 1,
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it("returns 401 with wrong password", async () => {
    const res = await request(app).post("/api/customer/auth/login").send({
      email: customerEmail,
      password: "wrongpassword",
      device_id: "integration-test-device",
      device_pixel_ratio: 1,
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 for non-existent email", async () => {
    const res = await request(app).post("/api/customer/auth/login").send({
      email: "nobody@example.com",
      password: "password123",
      device_id: "integration-test-device",
      device_pixel_ratio: 1,
    });

    expect(res.status).toBe(401);
  });

  it("returns 400 when fields missing", async () => {
    const res = await request(app).post("/api/customer/auth/login").send({});

    expect(res.status).toBe(400);
  });
});

describe("GET /api/customer/profile", () => {
  it("returns customer profile", async () => {
    const res = await request(app)
      .get("/api/customer/profile")
      .set(customerAuthHeader(customerToken));

    expect(res.status).toBe(200);
    expect(res.body.customer.email).toBe(customerEmail);
    expect(res.body.customer.password_hash).toBeUndefined();
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/customer/profile");
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/customer/profile", () => {
  it("updates first and last name", async () => {
    const res = await request(app)
      .put("/api/customer/profile")
      .set(customerAuthHeader(customerToken))
      .send({ first_name: "Updated", last_name: "Name" });

    expect(res.status).toBe(200);
    expect(res.body.customer.first_name).toBe("Updated");
    expect(res.body.customer.last_name).toBe("Name");
  });
});

describe("Cart operations", () => {
  it("GET /api/customer/cart — returns empty cart initially", async () => {
    const res = await request(app)
      .get("/api/customer/cart")
      .set(customerAuthHeader(customerToken));

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("POST /api/customer/cart — adds item to cart", async () => {
    const res = await request(app)
      .post("/api/customer/cart")
      .set(customerAuthHeader(customerToken))
      .send({ product_id: productId, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].product_id).toBe(productId);
    expect(res.body.items[0].quantity).toBe(2);
    expect(res.body.items[0].price).toBe("15.00");
  });

  it("POST /api/customer/cart — increments quantity on duplicate add", async () => {
    const res = await request(app)
      .post("/api/customer/cart")
      .set(customerAuthHeader(customerToken))
      .send({ product_id: productId, quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.items[0].quantity).toBe(5); // 2 + 3
  });

  it("PUT /api/customer/cart/:productId — sets exact quantity", async () => {
    const res = await request(app)
      .put(`/api/customer/cart/${productId}`)
      .set(customerAuthHeader(customerToken))
      .send({ quantity: 10 });

    expect(res.status).toBe(200);
    expect(res.body.items[0].quantity).toBe(10);
  });

  it("PUT /api/customer/cart/:productId — rejects quantity 0", async () => {
    const res = await request(app)
      .put(`/api/customer/cart/${productId}`)
      .set(customerAuthHeader(customerToken))
      .send({ quantity: 0 });

    expect(res.status).toBe(400);
  });

  it("GET /api/customer/cart — returns enriched cart with product data", async () => {
    const res = await request(app)
      .get("/api/customer/cart")
      .set(customerAuthHeader(customerToken));

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({
      product_id: productId,
      quantity: 10,
      price: "15.00",
    });
    expect(res.body.items[0].product_name).toBeDefined();
    expect(res.body.items[0].stock_quantity).toBeDefined();
  });

  it("DELETE /api/customer/cart/:productId — removes item", async () => {
    const res = await request(app)
      .delete(`/api/customer/cart/${productId}`)
      .set(customerAuthHeader(customerToken));

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("DELETE /api/customer/cart/:productId — returns 404 when item not in cart", async () => {
    const res = await request(app)
      .delete(`/api/customer/cart/${productId}`)
      .set(customerAuthHeader(customerToken));

    expect(res.status).toBe(404);
  });

  it("returns 401 on all cart routes without token", async () => {
    const routes = [
      { method: "get", path: "/api/customer/cart" },
      { method: "post", path: "/api/customer/cart" },
      { method: "put", path: `/api/customer/cart/${productId}` },
      { method: "delete", path: `/api/customer/cart/${productId}` },
    ];

    for (const route of routes) {
      const res = await (request(app) as any)[route.method](route.path);
      expect(res.status).toBe(401);
    }
  });
});
