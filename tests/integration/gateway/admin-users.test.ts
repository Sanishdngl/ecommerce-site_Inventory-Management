import request from "supertest";
import app from "../../../gateway/src/app";
import { loginAsSuperAdmin, adminAuthHeader } from "../helpers/auth";
import { deleteAdminUserByUsername } from "../helpers/cleanup";

let superAdminToken: string;
let createdUserId: string;

const TEST_USERNAME = `test_maintainer_${Date.now()}`;
const TEST_EMAIL = `test_${Date.now()}@example.com`;

beforeAll(async () => {
  const { token } = await loginAsSuperAdmin();
  superAdminToken = token;
});

afterAll(async () => {
  await deleteAdminUserByUsername(TEST_USERNAME);
});

describe("GET /api/admin/users", () => {
  it("returns paginated admin users for super_admin", async () => {
    const res = await request(app)
      .get("/api/admin/users")
      .set(adminAuthHeader(superAdminToken));

    expect(res.status).toBe(200);
    expect(res.body.users).toBeDefined();
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(401);
  });

  it("returns 403 for maintainer role", async () => {
    const createRes = await request(app)
      .post("/api/admin/users")
      .set(adminAuthHeader(superAdminToken))
      .send({
        username: `maintainer_${Date.now()}`,
        email: `m_${Date.now()}@test.com`,
        password: "testpassword123",
        role: "maintainer",
      });

    expect(createRes.status).toBe(201);
    const maintainerId = createRes.body.user.id;

    const loginRes = await request(app).post("/api/admin/auth/login").send({
      username: createRes.body.user.username,
      password: "testpassword123",
    });

    const maintainerToken = loginRes.body.token;

    const listRes = await request(app)
      .get("/api/admin/users")
      .set(adminAuthHeader(maintainerToken));

    expect(listRes.status).toBe(403);

    await request(app)
      .delete(`/api/admin/users/${maintainerId}`)
      .set(adminAuthHeader(superAdminToken));
  });
});

describe("POST /api/admin/users", () => {
  it("creates a maintainer user", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set(adminAuthHeader(superAdminToken))
      .send({
        username: TEST_USERNAME,
        email: TEST_EMAIL,
        password: "testpassword123",
        role: "maintainer",
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.username).toBe(TEST_USERNAME);
    expect(res.body.user.role).toBe("maintainer");
    expect(res.body.user.password_hash).toBeUndefined();

    createdUserId = res.body.user.id;
  });

  it("returns 409 on duplicate username", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set(adminAuthHeader(superAdminToken))
      .send({
        username: TEST_USERNAME,
        email: `other_${Date.now()}@test.com`,
        password: "testpassword123",
        role: "maintainer",
      });

    expect(res.status).toBe(409);
  });

  it("returns 400 when role is super_admin", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set(adminAuthHeader(superAdminToken))
      .send({
        username: `su_${Date.now()}`,
        email: `su_${Date.now()}@test.com`,
        password: "testpassword123",
        role: "super_admin",
      });

    expect(res.status).toBe(400);
  });

  it("returns 401 without token", async () => {
    const res = await request(app).post("/api/admin/users").send({
      username: "x",
      email: "x@x.com",
      password: "pass",
      role: "maintainer",
    });

    expect(res.status).toBe(401);
  });
});

describe("PUT /api/admin/users/:id", () => {
  it("updates the user role to reporter", async () => {
    const res = await request(app)
      .put(`/api/admin/users/${createdUserId}`)
      .set(adminAuthHeader(superAdminToken))
      .send({ role: "reporter" });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("reporter");
  });

  it("returns 404 for non-existent user", async () => {
    const res = await request(app)
      .put("/api/admin/users/00000000-0000-0000-0000-000000000000")
      .set(adminAuthHeader(superAdminToken))
      .send({ role: "reporter" });

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/admin/users/:id/status", () => {
  it("deactivates an active user", async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${createdUserId}/status`)
      .set(adminAuthHeader(superAdminToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns 403 when toggling own account", async () => {
    const { userId } = await loginAsSuperAdmin();

    const res = await request(app)
      .patch(`/api/admin/users/${userId}/status`)
      .set(adminAuthHeader(superAdminToken));

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/admin/users/:id", () => {
  it("deletes the test user", async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${createdUserId}`)
      .set(adminAuthHeader(superAdminToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns 404 for already deleted user", async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${createdUserId}`)
      .set(adminAuthHeader(superAdminToken));

    expect(res.status).toBe(404);
  });

  it("returns 403 when deleting own account", async () => {
    const { userId } = await loginAsSuperAdmin();

    const res = await request(app)
      .delete(`/api/admin/users/${userId}`)
      .set(adminAuthHeader(superAdminToken));

    expect(res.status).toBe(403);
  });
});
