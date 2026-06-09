import * as grpc from "@grpc/grpc-js";

const mockExecute = jest.fn();
jest.mock("@shared/db", () => ({ getDb: () => ({ execute: mockExecute }) }));
jest.mock("@shared/password", () => ({
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

import { verifyPassword } from "@shared/password";
import { verifyOAuthToken } from "../../../services/customer-service/src/auth/oauth";
import {
  registerCustomer,
  loginCustomer,
  oAuthLogin,
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
    ).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
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
        }),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
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
        }),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.ALREADY_EXISTS });
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
      makeCall({ email: "user@test.com", password: "password123" }),
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
      code: grpc.status.INVALID_ARGUMENT,
    });
  });

  it("throws UNAUTHENTICATED when customer not found", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      loginCustomer(
        makeCall({ email: "nobody@test.com", password: "pass" }),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.UNAUTHENTICATED });
  });

  it("throws UNAUTHENTICATED when customer is inactive", async () => {
    mockExecute.mockResolvedValueOnce([[makeCustomer({ is_active: false })]]);

    const callback = jest.fn();
    await expect(
      loginCustomer(
        makeCall({ email: "user@test.com", password: "pass" }),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.UNAUTHENTICATED });
  });

  it("throws UNAUTHENTICATED when password_hash is null — OAuth-only account", async () => {
    mockExecute.mockResolvedValueOnce([
      [makeCustomer({ password_hash: null })],
    ]);

    const callback = jest.fn();
    await expect(
      loginCustomer(
        makeCall({ email: "user@test.com", password: "pass" }),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.UNAUTHENTICATED });
  });

  it("throws UNAUTHENTICATED on wrong password", async () => {
    mockExecute.mockResolvedValueOnce([[makeCustomer()]]);
    (verifyPassword as jest.Mock).mockResolvedValueOnce(false);

    const callback = jest.fn();
    await expect(
      loginCustomer(
        makeCall({ email: "user@test.com", password: "wrong" }),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.UNAUTHENTICATED });
  });
});

describe("oAuthLogin", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws INVALID_ARGUMENT when fields missing", async () => {
    const callback = jest.fn();
    await expect(oAuthLogin(makeCall({}), callback)).rejects.toMatchObject({
      code: grpc.status.INVALID_ARGUMENT,
    });
  });

  it("throws UNAUTHENTICATED when OAuth verification fails", async () => {
    (verifyOAuthToken as jest.Mock).mockRejectedValueOnce(
      new Error("bad token")
    );

    const callback = jest.fn();
    await expect(
      oAuthLogin(makeCall({ provider: "google", token: "bad" }), callback)
    ).rejects.toMatchObject({ code: grpc.status.UNAUTHENTICATED });
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
      makeCall({ provider: "google", token: "valid-token" }),
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
      makeCall({ provider: "google", token: "valid-token" }),
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
        makeCall({ provider: "google", token: "valid-token" }),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.UNAUTHENTICATED });
  });
});
