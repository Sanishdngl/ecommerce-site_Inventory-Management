import request from "supertest";
import app from "../../gateway/src/app";

describe("Customer Auth", () => {
  it("POST /api/customer/auth/register — rejects missing fields", async () => {
    const res = await request(app)
      .post("/api/customer/auth/register")
      .send({ email: "test@example.com" });

    expect(res.status).toBe(400);
  });

  it("POST /api/customer/auth/login — rejects invalid credentials", async () => {
    const res = await request(app)
      .post("/api/customer/auth/login")
      .send({ email: "nobody@example.com", password: "wrongpassword" });

    expect(res.status).toBe(401);
  });
});

describe("Customer Cart — unauthenticated", () => {
  it("GET /api/customer/cart — rejects without token", async () => {
    const res = await request(app).get("/api/customer/cart");
    expect(res.status).toBe(401);
  });

  it("POST /api/customer/cart — rejects without token", async () => {
    const res = await request(app).post("/api/customer/cart").send({});
    expect(res.status).toBe(401);
  });
});
