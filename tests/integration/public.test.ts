import request from "supertest";
import app from "../../gateway/src/app";

describe("Public Routes", () => {
  it("GET /api/categories — returns 200", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    expect(res.body.categories).toBeDefined();
  });

  it("GET /api/products — requires category slug", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(400);
  });

  it("GET /api/products/:id — returns 404 for unknown id", async () => {
    const res = await request(app).get(
      "/api/products/00000000-0000-0000-0000-000000000000"
    );
    expect(res.status).toBe(404);
  });
});
