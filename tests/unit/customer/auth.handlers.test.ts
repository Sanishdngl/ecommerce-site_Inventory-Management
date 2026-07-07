const mockExecute = jest.fn();
const mockCacheSet = jest.fn().mockResolvedValue(undefined);
const mockCacheGet = jest.fn();
const mockCacheDel = jest.fn().mockResolvedValue(undefined);
jest.mock("@infrastructure/database/mysql", () => ({
  getDb: () => ({ execute: mockExecute }),
}));
jest.mock("@infrastructure/redis/redis", () => ({
  cacheSet: (...args: any[]) => mockCacheSet(...args),
  cacheGet: (...args: any[]) => mockCacheGet(...args),
  cacheDel: (...args: any[]) => mockCacheDel(...args),
  TTL: {
    REFRESH_TOKEN_CUSTOMER: 30 * 24 * 60 * 60,
    REFRESH_GRACE_PERIOD: 60,
  },
  CacheKey: {
    refreshCustomer: (customerId: string, deviceId: string) =>
      `refresh:customer:${customerId}:${deviceId}`,
  },
}));
jest.mock("@shared/auth/password", () => ({
  hashPassword: jest
    .fn()
    .mockResolvedValue("TEST_HASH_NOT_A_REAL_BCRYPT_VALUE"),
  verifyPassword: jest.fn(),
}));
jest.mock("@shared/errors", () => {
  const actual = jest.requireActual("@shared/errors");
  return { ...actual, handle: (fn: any) => fn };
});
jest.mock("../../../services/customer-service/src/auth/oauth", () => ({
  verifyOAuthToken: jest.fn(),
}));

import { verifyPassword } from "../../../shared/src/auth/password";
import { generateRefreshToken } from "../../../shared/src/auth/refresh-token";
import { verifyOAuthToken } from "../../../services/customer-service/src/auth/oauth";
import {
  registerCustomer,
  loginCustomer,
  oAuthLogin,
  logoutCustomer,
  refreshCustomerToken,
} from "../../../services/customer-service/src/handlers/auth.handlers";

function makeCall(request: any): any {
  return { request, metadata: { get: () => [] } };
}

function makeCustomer(overrides: any = {}): any {
  return {
    id: "cust-1",
    email: "user@test.com",
    password_hash: "TEST_HASH_NOT_A_REAL_BCRYPT_VALUE",
    oauth_provider: null,
    oauth_id: null,
    first_name: "John",
    last_name: "Doe",
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe("registerCustomer", () => {
  beforeEach(() => jest.clearAllMocks());

  it("registers a new customer successfully", async () => {
    const customer = makeCustomer();
    mockExecute
      .mockResolvedValueOnce([[]]) // email not found
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // insert
      .mockResolvedValueOnce([[customer]]); // findById

    const callback = jest.fn();
    await registerCustomer(
      makeCall({
        email: "user@test.com",
        password: "password123",
        first_name: "John",
        last_name: "Doe",
        device_id: "device-1",
        device_pixel_ratio: 1,
      }),
      callback
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        customer: expect.objectContaining({ email: "user@test.com" }),
      })
    );
  });

  it("throws INVALID_ARGUMENT when required fields missing", async () => {
    const callback = jest.fn();
    await expect(
      registerCustomer(makeCall({ email: "x@x.com" }), callback)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws INVALID_ARGUMENT when password under 8 characters", async () => {
    const callback = jest.fn();
    await expect(
      registerCustomer(
        makeCall({
          email: "x@x.com",
          password: "short",
          first_name: "A",
          last_name: "B",
          device_id: "device-1",
          device_pixel_ratio: 1,
        }),
        callback
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws ALREADY_EXISTS when email taken", async () => {
    mockExecute.mockResolvedValueOnce([[makeCustomer()]]);

    const callback = jest.fn();
    await expect(
      registerCustomer(
        makeCall({
          email: "user@test.com",
          password: "password123",
          first_name: "A",
          last_name: "B",
          device_id: "device-1",
          device_pixel_ratio: 1,
        }),
        callback
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("does not expose password_hash in response", async () => {
    const customer = makeCustomer();
    mockExecute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[customer]]);

    const callback = jest.fn();
    await registerCustomer(
      makeCall({
        email: "user@test.com",
        password: "password123",
        first_name: "A",
        last_name: "B",
        device_id: "device-1",
        device_pixel_ratio: 1,
      }),
      callback
    );

    expect(callback.mock.calls[0][1].customer.password_hash).toBeUndefined();
  });
});

describe("loginCustomer", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns customer on valid credentials", async () => {
    const customer = makeCustomer();
    mockExecute.mockResolvedValueOnce([[customer]]);
    (verifyPassword as jest.Mock).mockResolvedValueOnce(true);

    const callback = jest.fn();
    await loginCustomer(
      makeCall({
        email: "user@test.com",
        password: "password123",
        device_id: "device-1",
        device_pixel_ratio: 1,
      }),
      callback
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        customer: expect.objectContaining({ id: "cust-1" }),
      })
    );
  });

  it("throws INVALID_ARGUMENT when fields missing", async () => {
    const callback = jest.fn();
    await expect(loginCustomer(makeCall({}), callback)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("throws UNAUTHENTICATED when customer not found", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      loginCustomer(
        makeCall({
          email: "nobody@test.com",
          password: "pass",
          device_id: "device-1",
          device_pixel_ratio: 1,
        }),
        callback
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws UNAUTHENTICATED when customer is inactive", async () => {
    mockExecute.mockResolvedValueOnce([[makeCustomer({ is_active: false })]]);

    const callback = jest.fn();
    await expect(
      loginCustomer(
        makeCall({
          email: "user@test.com",
          password: "pass",
          device_id: "device-1",
          device_pixel_ratio: 1,
        }),
        callback
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws UNAUTHENTICATED when password_hash is null — OAuth-only account", async () => {
    mockExecute.mockResolvedValueOnce([
      [makeCustomer({ password_hash: null })],
    ]);

    const callback = jest.fn();
    await expect(
      loginCustomer(
        makeCall({
          email: "user@test.com",
          password: "pass",
          device_id: "device-1",
          device_pixel_ratio: 1,
        }),
        callback
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws UNAUTHENTICATED on wrong password", async () => {
    mockExecute.mockResolvedValueOnce([[makeCustomer()]]);
    (verifyPassword as jest.Mock).mockResolvedValueOnce(false);

    const callback = jest.fn();
    await expect(
      loginCustomer(
        makeCall({
          email: "user@test.com",
          password: "wrong",
          device_id: "device-1",
          device_pixel_ratio: 1,
        }),
        callback
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("oAuthLogin", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws INVALID_ARGUMENT when fields missing", async () => {
    const callback = jest.fn();
    await expect(oAuthLogin(makeCall({}), callback)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("throws UNAUTHENTICATED when OAuth verification fails", async () => {
    (verifyOAuthToken as jest.Mock).mockRejectedValueOnce(
      new Error("bad token")
    );

    const callback = jest.fn();
    await expect(
      oAuthLogin(
        makeCall({
          provider: "google",
          token: "bad",
          device_id: "device-1",
          device_pixel_ratio: 1,
        }),
        callback
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns existing customer on valid OAuth token", async () => {
    const customer = makeCustomer({
      oauth_provider: "google",
      oauth_id: "g-123",
    });
    (verifyOAuthToken as jest.Mock).mockResolvedValueOnce({
      oauth_id: "g-123",
      email: "user@test.com",
      first_name: "John",
      last_name: "Doe",
      oauth_provider: "google",
    });
    mockExecute.mockResolvedValueOnce([[customer]]); // findByOAuth — found

    const callback = jest.fn();
    await oAuthLogin(
      makeCall({
        provider: "google",
        token: "valid-token",
        device_id: "device-1",
        device_pixel_ratio: 1,
      }),
      callback
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        customer: expect.objectContaining({ id: "cust-1" }),
      })
    );
  });

  it("creates new customer when OAuth account does not exist", async () => {
    const newCustomer = makeCustomer({
      oauth_provider: "google",
      oauth_id: "g-new",
    });
    (verifyOAuthToken as jest.Mock).mockResolvedValueOnce({
      oauth_id: "g-new",
      email: "new@test.com",
      first_name: "Jane",
      last_name: "Smith",
      oauth_provider: "google",
    });
    mockExecute
      .mockResolvedValueOnce([[]]) // findByOAuth — not found
      .mockResolvedValueOnce([[]]) // findByEmail — not found
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // insert
      .mockResolvedValueOnce([[newCustomer]]); // findById

    const callback = jest.fn();
    await oAuthLogin(
      makeCall({
        provider: "google",
        token: "valid-token",
        device_id: "device-1",
        device_pixel_ratio: 1,
      }),
      callback
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        customer: expect.objectContaining({ oauth_provider: "google" }),
      })
    );
  });

  it("throws UNAUTHENTICATED when account is inactive", async () => {
    (verifyOAuthToken as jest.Mock).mockResolvedValueOnce({
      oauth_id: "g-123",
      email: "user@test.com",
      first_name: "John",
      last_name: "Doe",
      oauth_provider: "google",
    });
    mockExecute.mockResolvedValueOnce([[makeCustomer({ is_active: false })]]);

    const callback = jest.fn();
    await expect(
      oAuthLogin(
        makeCall({
          provider: "google",
          token: "valid-token",
          device_id: "device-1",
          device_pixel_ratio: 1,
        }),
        callback
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("logoutCustomer", () => {
  beforeEach(() => jest.clearAllMocks());

  it("deletes the cached refresh token when given a valid token", async () => {
    const token = generateRefreshToken("cust-1", "device-1");

    const callback = jest.fn();
    await logoutCustomer(makeCall({ refresh_token: token }), callback);

    expect(mockCacheDel).toHaveBeenCalledWith(
      "refresh:customer:cust-1:device-1"
    );
    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ success: true })
    );
  });

  it("succeeds without deleting anything when no refresh_token is given", async () => {
    const callback = jest.fn();
    await logoutCustomer(makeCall({}), callback);

    expect(mockCacheDel).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ success: true })
    );
  });

  it("succeeds without deleting anything when refresh_token is malformed", async () => {
    const callback = jest.fn();
    await logoutCustomer(
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

describe("refreshCustomerToken", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws BAD_REQUEST when refresh_token is missing", async () => {
    const callback = jest.fn();
    await expect(
      refreshCustomerToken(makeCall({}), callback)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws UNAUTHORIZED when refresh_token is malformed", async () => {
    const callback = jest.fn();
    await expect(
      refreshCustomerToken(
        makeCall({ refresh_token: "not-a-real-token" }),
        callback
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws UNAUTHORIZED when no cache entry exists (expired/invalid)", async () => {
    const token = generateRefreshToken("cust-1", "device-1");
    mockCacheGet.mockResolvedValueOnce(undefined);

    const callback = jest.fn();
    await expect(
      refreshCustomerToken(makeCall({ refresh_token: token }), callback)
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws UNAUTHORIZED when token matches neither current nor previous", async () => {
    const token = generateRefreshToken("cust-1", "device-1");
    mockCacheGet.mockResolvedValueOnce(
      JSON.stringify({
        token: "some-other-current-token",
        device_pixel_ratio: 1,
        created_at: new Date().toISOString(),
      })
    );

    const callback = jest.fn();
    await expect(
      refreshCustomerToken(makeCall({ refresh_token: token }), callback)
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws UNAUTHORIZED and evicts the cache key when the customer is gone or inactive", async () => {
    const token = generateRefreshToken("cust-1", "device-1");
    mockCacheGet.mockResolvedValueOnce(
      JSON.stringify({
        token,
        device_pixel_ratio: 1,
        created_at: new Date().toISOString(),
      })
    );
    mockExecute.mockResolvedValueOnce([[]]); // findCustomerById -> not found

    const callback = jest.fn();
    await expect(
      refreshCustomerToken(makeCall({ refresh_token: token }), callback)
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(mockCacheDel).toHaveBeenCalledWith(
      "refresh:customer:cust-1:device-1"
    );
  });

  it("rotates the token and returns a new refresh_token on the current token", async () => {
    const token = generateRefreshToken("cust-1", "device-1");
    mockCacheGet.mockResolvedValueOnce(
      JSON.stringify({
        token,
        device_pixel_ratio: 2,
        created_at: new Date().toISOString(),
      })
    );
    mockExecute.mockResolvedValueOnce([[makeCustomer()]]); // findCustomerById

    const callback = jest.fn();
    await refreshCustomerToken(makeCall({ refresh_token: token }), callback);

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        customer_id: "cust-1",
        refresh_token: expect.any(String),
        customer: expect.objectContaining({ id: "cust-1" }),
      })
    );
    const [, response] = callback.mock.calls[0];
    expect(response.refresh_token).not.toBe(token); // rotated, not reused

    expect(mockCacheSet).toHaveBeenCalledWith(
      "refresh:customer:cust-1:device-1",
      expect.stringContaining(response.refresh_token),
      30 * 24 * 60 * 60
    );
  });

  it("returns the still-current token without rotating during the previous-token grace period", async () => {
    const oldToken = generateRefreshToken("cust-1", "device-1");
    const newToken = generateRefreshToken("cust-1", "device-1");
    mockCacheGet.mockResolvedValueOnce(
      JSON.stringify({
        token: newToken,
        previous_token: oldToken,
        previous_token_expires_at: Date.now() + 30_000, // still within grace period
        device_pixel_ratio: 1,
        created_at: new Date().toISOString(),
      })
    );
    mockExecute.mockResolvedValueOnce([[makeCustomer()]]);

    const callback = jest.fn();
    await refreshCustomerToken(makeCall({ refresh_token: oldToken }), callback);

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        customer_id: "cust-1",
        refresh_token: newToken,
      })
    );
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it("does not expose password_hash on rotation", async () => {
    const token = generateRefreshToken("cust-1", "device-1");
    mockCacheGet.mockResolvedValueOnce(
      JSON.stringify({
        token,
        device_pixel_ratio: 1,
        created_at: new Date().toISOString(),
      })
    );
    mockExecute.mockResolvedValueOnce([[makeCustomer()]]);

    const callback = jest.fn();
    await refreshCustomerToken(makeCall({ refresh_token: token }), callback);

    const [, response] = callback.mock.calls[0];
    expect(response.customer.password_hash).toBeUndefined();
  });
});
