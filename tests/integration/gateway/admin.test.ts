import request from "supertest";
import app from "../../../gateway/src/app";

describe("POST /api/admin/auth/login", () => {
  it("returns JWT on valid credentials", async () => {
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({
        username: process.env.SUPER_ADMIN_USERNAME ?? "superadmin",
        password: process.env.SUPER_ADMIN_PASSWORD,
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it("returns 401 on wrong password", async () => {
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({ username: "superadmin", password: "wrongpassword" });

    expect(res.status).toBe(401);
  });

  it("returns 401 for non-existent user", async () => {
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({ username: "nobody", password: "somepassword" });

    expect(res.status).toBe(401);
  });

  it("returns 400 when fields missing", async () => {
    const res = await request(app).post("/api/admin/auth/login").send({});

    expect(res.status).toBe(400);
  });

  it("rate limits after 10 attempts", async () => {
    const attempts = Array.from({ length: 11 }, () =>
      request(app)
        .post("/api/admin/auth/login")
        .send({ username: "nobody", password: "wrong" })
    );

    const results = await Promise.all(attempts);
    const tooMany = results.some((r) => r.status === 429);
    expect(tooMany).toBe(true);
  });
});
