import request from "supertest";
import app from "../../gateway/src/app";

describe("Admin Auth", () => {
  it("POST /api/admin/auth/login — rejects missing credentials", async () => {
    const res = await request(app).post("/api/admin/auth/login").send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
  });

  it("POST /api/admin/auth/login — rejects invalid credentials", async () => {
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({ username: "nobody", password: "wrongpassword" });

    expect(res.status).toBe(401);
  });
});

describe("Admin Users — unauthenticated", () => {
  it("GET /api/admin/users — rejects without token", async () => {
    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(401);
  });

  it("POST /api/admin/users — rejects without token", async () => {
    const res = await request(app).post("/api/admin/users").send({});
    expect(res.status).toBe(401);
  });
});
