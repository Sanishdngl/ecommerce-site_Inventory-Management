const mockExecute = jest.fn();
const mockCacheSet = jest.fn().mockResolvedValue(undefined);
const mockCacheGet = jest.fn();
const mockCacheDel = jest.fn().mockResolvedValue(undefined);
jest.mock("@infrastructure/database/mysql", () => ({
  getDb: () => ({ execute: mockExecute }),
}));

jest.mock("@infrastructure/observability/audit", () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@shared/auth/password", () => ({
  hashPassword: jest
    .fn()
    .mockResolvedValue("'TEST_HASH_NOT_A_REAL_BCRYPT_VALUE'"),
  verifyPassword: jest.fn(),
}));

jest.mock("@infrastructure/redis/redis", () => ({
  cacheSet: (...args: any[]) => mockCacheSet(...args),
  cacheGet: (...args: any[]) => mockCacheGet(...args),
  cacheDel: (...args: any[]) => mockCacheDel(...args),
  TTL: { REFRESH_TOKEN_ADMIN: 30 * 24 * 60 * 60, REFRESH_GRACE_PERIOD: 60 },
  CacheKey: {
    refreshAdmin: (adminId: string, deviceId: string) =>
      `refresh:admin:${adminId}:${deviceId}`,
  },
}));

jest.mock("@shared/errors", () => {
  const actual = jest.requireActual("@shared/errors");
  return {
    ...actual,
    handle: (fn: any) => fn,
  };
});

import { verifyPassword } from "../../../shared/src/auth/password";
import { generateRefreshToken } from "../../../shared/src/auth/refresh-token";
import { writeAuditLog } from "../../../infrastructure/observability/audit";
import {
  loginAdmin,
  logoutAdmin,
  refreshAdminToken,
  createAdminUser,
  deleteAdminUser,
  toggleAdminStatus,
  listAdminUsersHandler,
} from "../../../services/admin-service/src/handlers/admin.handlers";

function makeCall(request: any, meta: Record<string, string> = {}): any {
  return {
    request,
    metadata: {
      get: (key: string) => (meta[key] ? [meta[key]] : []),
    },
  };
}

function makeAdminUser(overrides: Partial<any> = {}): any {
  return {
    id: "admin-1",
    username: "testadmin",
    email: "admin@test.com",
    password_hash: "TEST_HASH_NOT_A_REAL_BCRYPT_VALUE",
    role: "super_admin",
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe("loginAdmin", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns user on valid credentials", async () => {
    const user = makeAdminUser();
    mockExecute.mockResolvedValueOnce([[user]]);
    (verifyPassword as jest.Mock).mockResolvedValueOnce(true);

    const callback = jest.fn();
    await loginAdmin(
      makeCall({
        username: "testadmin",
        password: "pass123",
        device_id: "device-1",
        device_pixel_ratio: 1,
      }),
      callback
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        user: expect.objectContaining({ id: "admin-1" }),
      })
    );
  });

  it("throws INVALID_ARGUMENT when username or password missing", async () => {
    const callback = jest.fn();
    await expect(
      loginAdmin(makeCall({ username: "", password: "" }), callback)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws UNAUTHENTICATED when user not found", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      loginAdmin(
        makeCall({
          username: "nobody",
          password: "pass",
          device_id: "device-1",
          device_pixel_ratio: 1,
        }),
        callback
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws UNAUTHENTICATED when user is inactive", async () => {
    mockExecute.mockResolvedValueOnce([[makeAdminUser({ is_active: false })]]);

    const callback = jest.fn();
    await expect(
      loginAdmin(
        makeCall({
          username: "testadmin",
          password: "pass",
          device_id: "device-1",
          device_pixel_ratio: 1,
        }),
        callback
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws UNAUTHENTICATED on wrong password", async () => {
    mockExecute.mockResolvedValueOnce([[makeAdminUser()]]);
    (verifyPassword as jest.Mock).mockResolvedValueOnce(false);

    const callback = jest.fn();
    await expect(
      loginAdmin(
        makeCall({
          username: "testadmin",
          password: "wrong",
          device_id: "device-1",
          device_pixel_ratio: 1,
        }),
        callback
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("does not expose password_hash in response", async () => {
    mockExecute.mockResolvedValueOnce([[makeAdminUser()]]);
    (verifyPassword as jest.Mock).mockResolvedValueOnce(true);

    const callback = jest.fn();
    await loginAdmin(
      makeCall({
        username: "testadmin",
        password: "pass",
        device_id: "device-1",
        device_pixel_ratio: 1,
      }),
      callback
    );

    const returned = callback.mock.calls[0][1];
    expect(returned.user.password_hash).toBeUndefined();
  });
});

describe("createAdminUser", () => {
  beforeEach(() => jest.clearAllMocks());

  const meta = {
    admin_id: "11111111-1111-4111-8111-111111111111",
    role: "super_admin",
  };

  it("creates user successfully", async () => {
    const newUser = makeAdminUser({ role: "maintainer" });

    mockExecute
      .mockResolvedValueOnce([[]]) // findAdminByUsername — not found
      .mockResolvedValueOnce([[]]) // findAdminByEmail — not found
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // insert
      .mockResolvedValueOnce([[newUser]]); // findById after insert

    const callback = jest.fn();
    await createAdminUser(
      makeCall(
        {
          username: "newadmin",
          email: "new@test.com",
          password: "password123",
          role: "MAINTAINER",
        },
        meta
      ),
      callback
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        user: expect.objectContaining({ role: "MAINTAINER" }),
      })
    );
    expect(writeAuditLog).toHaveBeenCalled();
  });

  it("throws PERMISSION_DENIED when caller is not super_admin", async () => {
    const callback = jest.fn();
    await expect(
      createAdminUser(
        makeCall(
          {
            username: "x",
            email: "x@x.com",
            password: "password123",
            role: "MAINTAINER",
          },
          { admin_id: "a1", role: "maintainer" }
        ),
        callback
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws INVALID_ARGUMENT when required fields missing", async () => {
    const callback = jest.fn();
    await expect(
      createAdminUser(
        makeCall({ username: "", email: "", password: "", role: "" }, meta),
        callback
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws INVALID_ARGUMENT when role is super_admin", async () => {
    const callback = jest.fn();
    await expect(
      createAdminUser(
        makeCall(
          {
            username: "x",
            email: "x@x.com",
            password: "password123",
            role: "SUPER_ADMIN",
          },
          meta
        ),
        callback
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws ALREADY_EXISTS on duplicate username", async () => {
    mockExecute.mockResolvedValueOnce([[makeAdminUser()]]);

    const callback = jest.fn();
    await expect(
      createAdminUser(
        makeCall(
          {
            username: "testadmin",
            email: "new@test.com",
            password: "password123",
            role: "MAINTAINER",
          },
          meta
        ),
        callback
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("throws ALREADY_EXISTS on duplicate email", async () => {
    mockExecute
      .mockResolvedValueOnce([[]]) // username not found
      .mockResolvedValueOnce([[makeAdminUser()]]); // email found

    const callback = jest.fn();
    await expect(
      createAdminUser(
        makeCall(
          {
            username: "newuser",
            email: "admin@test.com",
            password: "password123",
            role: "MAINTAINER",
          },
          meta
        ),
        callback
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("deleteAdminUser", () => {
  beforeEach(() => jest.clearAllMocks());

  const meta = {
    admin_id: "11111111-1111-4111-8111-111111111111",
    role: "super_admin",
  };

  it("deletes user and writes audit log", async () => {
    const user = makeAdminUser({ id: "22222222-2222-4222-8222-222222222222" });
    mockExecute
      .mockResolvedValueOnce([[user]]) // findById
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // delete

    const callback = jest.fn();
    await deleteAdminUser(
      makeCall({ id: "22222222-2222-4222-8222-222222222222" }, meta),
      callback
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ success: true })
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "delete", entity_type: "admin_user" })
    );
  });

  it("throws PERMISSION_DENIED when deleting own account", async () => {
    const user = makeAdminUser({ id: "11111111-1111-4111-8111-111111111111" });
    mockExecute.mockResolvedValueOnce([[user]]);

    const callback = jest.fn();
    await expect(
      deleteAdminUser(
        makeCall({ id: "11111111-1111-4111-8111-111111111111" }, meta),
        callback
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws NOT_FOUND when user does not exist", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      deleteAdminUser(
        makeCall({ id: "00000000-0000-4000-8000-000000000000" }, meta),
        callback
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws PERMISSION_DENIED when caller is not super_admin", async () => {
    const callback = jest.fn();
    await expect(
      deleteAdminUser(
        makeCall(
          { id: "22222222-2222-4222-8222-222222222222" },
          { admin_id: "a1", role: "maintainer" }
        ),
        callback
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("toggleAdminStatus", () => {
  beforeEach(() => jest.clearAllMocks());

  const meta = {
    admin_id: "11111111-1111-4111-8111-111111111111",
    role: "super_admin",
  };

  it("toggles status and writes audit log with before/after", async () => {
    const user = makeAdminUser({
      id: "22222222-2222-4222-8222-222222222222",
      is_active: true,
    });
    mockExecute
      .mockResolvedValueOnce([[user]]) //findById
      .mockResolvedValueOnce([{ affectedRows: 1 }]) //toggle update
      .mockResolvedValueOnce([[user]]); // findById inside

    const callback = jest.fn();
    await toggleAdminStatus(
      makeCall({ id: "22222222-2222-4222-8222-222222222222" }, meta),
      callback
    );

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: { is_active: { from: true, to: false } },
      })
    );
  });

  it("throws PERMISSION_DENIED when toggling own account", async () => {
    const user = makeAdminUser({ id: "11111111-1111-4111-8111-111111111111" });
    mockExecute.mockResolvedValueOnce([[user]]);

    const callback = jest.fn();
    await expect(
      toggleAdminStatus(
        makeCall({ id: "11111111-1111-4111-8111-111111111111" }, meta),
        callback
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// listAdminUsersHandler
describe("listAdminUsersHandler", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns paginated users", async () => {
    const users = [
      makeAdminUser(),
      makeAdminUser({ id: "admin-2", username: "admin2" }),
    ];
    mockExecute
      .mockResolvedValueOnce([users])
      .mockResolvedValueOnce([[{ total: 2 }]]);

    const callback = jest.fn();
    await listAdminUsersHandler(
      makeCall(
        { pagination: { page: 1, limit: 20 } },
        { admin_id: "a1", role: "super_admin" }
      ),
      callback
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        users: expect.arrayContaining([
          expect.objectContaining({ id: "admin-1" }),
        ]),
        pagination: expect.objectContaining({ total: 2 }),
      })
    );
  });

  it("strips password_hash from all users", async () => {
    const users = [makeAdminUser()];
    mockExecute
      .mockResolvedValueOnce([users])
      .mockResolvedValueOnce([[{ total: 1 }]]);

    const callback = jest.fn();
    await listAdminUsersHandler(
      makeCall(
        { pagination: { page: 1, limit: 20 } },
        { admin_id: "a1", role: "super_admin" }
      ),
      callback
    );

    const returned = callback.mock.calls[0][1];
    returned.users.forEach((u: any) => expect(u.password_hash).toBeUndefined());
  });
});

describe("logoutAdmin", () => {
  beforeEach(() => jest.clearAllMocks());

  it("deletes the cached refresh token when given a valid token", async () => {
    const token = generateRefreshToken("admin-1", "device-1");

    const callback = jest.fn();
    await logoutAdmin(makeCall({ refresh_token: token }), callback);

    expect(mockCacheDel).toHaveBeenCalledWith("refresh:admin:admin-1:device-1");
    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ success: true })
    );
  });

  it("succeeds without deleting anything when no refresh_token is given", async () => {
    const callback = jest.fn();
    await logoutAdmin(makeCall({}), callback);

    expect(mockCacheDel).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ success: true })
    );
  });

  it("succeeds without deleting anything when refresh_token is malformed", async () => {
    const callback = jest.fn();
    await logoutAdmin(
      makeCall({ refresh_token: "not-a-real-token" }),
      callback
    );

    expect(mockCacheDel).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ success: true })
    );
  });
});

describe("refreshAdminToken", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws BAD_REQUEST when refresh_token is missing", async () => {
    const callback = jest.fn();
    await expect(
      refreshAdminToken(makeCall({}), callback)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws UNAUTHORIZED when refresh_token is malformed", async () => {
    const callback = jest.fn();
    await expect(
      refreshAdminToken(
        makeCall({ refresh_token: "not-a-real-token" }),
        callback
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws UNAUTHORIZED when no cache entry exists (expired/invalid)", async () => {
    const token = generateRefreshToken("admin-1", "device-1");
    mockCacheGet.mockResolvedValueOnce(undefined);

    const callback = jest.fn();
    await expect(
      refreshAdminToken(makeCall({ refresh_token: token }), callback)
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws UNAUTHORIZED when token matches neither current nor previous", async () => {
    const token = generateRefreshToken("admin-1", "device-1");
    mockCacheGet.mockResolvedValueOnce(
      JSON.stringify({
        token: "some-other-current-token",
        role: "super_admin",
        device_pixel_ratio: 1,
        created_at: new Date().toISOString(),
      })
    );

    const callback = jest.fn();
    await expect(
      refreshAdminToken(makeCall({ refresh_token: token }), callback)
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws UNAUTHORIZED and evicts the cache key when the admin is gone or deactivated", async () => {
    const token = generateRefreshToken("admin-1", "device-1");
    mockCacheGet.mockResolvedValueOnce(
      JSON.stringify({
        token,
        role: "super_admin",
        device_pixel_ratio: 1,
        created_at: new Date().toISOString(),
      })
    );
    mockExecute.mockResolvedValueOnce([[]]); // findAdminById -> not found

    const callback = jest.fn();
    await expect(
      refreshAdminToken(makeCall({ refresh_token: token }), callback)
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(mockCacheDel).toHaveBeenCalledWith("refresh:admin:admin-1:device-1");
  });

  it("rotates the token and returns a new refresh_token on the current token", async () => {
    const token = generateRefreshToken("admin-1", "device-1");
    mockCacheGet.mockResolvedValueOnce(
      JSON.stringify({
        token,
        role: "super_admin",
        device_pixel_ratio: 2,
        created_at: new Date().toISOString(),
      })
    );
    mockExecute.mockResolvedValueOnce([[makeAdminUser()]]); // findAdminById

    const callback = jest.fn();
    await refreshAdminToken(makeCall({ refresh_token: token }), callback);

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        admin_id: "admin-1",
        role: "SUPER_ADMIN",
        refresh_token: expect.any(String),
        user: expect.objectContaining({ id: "admin-1" }),
      })
    );
    const [, response] = callback.mock.calls[0];
    expect(response.refresh_token).not.toBe(token); // rotated, not reused

    expect(mockCacheSet).toHaveBeenCalledWith(
      "refresh:admin:admin-1:device-1",
      expect.stringContaining(response.refresh_token),
      30 * 24 * 60 * 60
    );
  });

  it("returns the still-current token without rotating during the previous-token grace period", async () => {
    const oldToken = generateRefreshToken("admin-1", "device-1");
    const newToken = generateRefreshToken("admin-1", "device-1");
    mockCacheGet.mockResolvedValueOnce(
      JSON.stringify({
        token: newToken,
        previous_token: oldToken,
        previous_token_expires_at: Date.now() + 30_000, // still within grace period
        role: "super_admin",
        device_pixel_ratio: 1,
        created_at: new Date().toISOString(),
      })
    );
    mockExecute.mockResolvedValueOnce([[makeAdminUser()]]);

    const callback = jest.fn();
    await refreshAdminToken(makeCall({ refresh_token: oldToken }), callback);

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        admin_id: "admin-1",
        refresh_token: newToken,
      })
    );
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it("does not expose password_hash on rotation", async () => {
    const token = generateRefreshToken("admin-1", "device-1");
    mockCacheGet.mockResolvedValueOnce(
      JSON.stringify({
        token,
        role: "super_admin",
        device_pixel_ratio: 1,
        created_at: new Date().toISOString(),
      })
    );
    mockExecute.mockResolvedValueOnce([[makeAdminUser()]]);

    const callback = jest.fn();
    await refreshAdminToken(makeCall({ refresh_token: token }), callback);

    const [, response] = callback.mock.calls[0];
    expect(response.user.password_hash).toBeUndefined();
  });
});
