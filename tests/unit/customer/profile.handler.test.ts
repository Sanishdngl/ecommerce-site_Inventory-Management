import * as grpc from "@grpc/grpc-js";

const mockExecute = jest.fn();
jest.mock("@shared/db", () => ({ getDb: () => ({ execute: mockExecute }) }));
jest.mock("@shared/errors", () => {
  const actual = jest.requireActual("@shared/errors");
  return { ...actual, handle: (fn: any) => fn };
});

import {
  getProfile,
  updateProfile,
} from "../../../services/customer-service/src/handlers/profile.handlers";

function makeCall(request: any): any {
  return { request, metadata: { get: () => [] } };
}

function makeCustomer(overrides: any = {}): any {
  return {
    id: "cust-1",
    email: "user@test.com",
    password_hash: "$2b$12$hashed",
    first_name: "John",
    last_name: "Doe",
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe("getProfile", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns customer profile", async () => {
    mockExecute.mockResolvedValueOnce([[makeCustomer()]]);

    const callback = jest.fn();
    await getProfile(makeCall({ customer_id: "cust-1" }), callback);

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        customer: expect.objectContaining({ id: "cust-1" }),
      })
    );
  });

  it("throws INVALID_ARGUMENT when customer_id missing", async () => {
    const callback = jest.fn();
    await expect(getProfile(makeCall({}), callback)).rejects.toMatchObject({
      code: grpc.status.INVALID_ARGUMENT,
    });
  });

  it("throws NOT_FOUND when customer does not exist", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      getProfile(makeCall({ customer_id: "ghost" }), callback)
    ).rejects.toMatchObject({ code: grpc.status.NOT_FOUND });
  });

  it("does not expose password_hash", async () => {
    mockExecute.mockResolvedValueOnce([[makeCustomer()]]);

    const callback = jest.fn();
    await getProfile(makeCall({ customer_id: "cust-1" }), callback);

    expect(callback.mock.calls[0][1].customer.password_hash).toBeUndefined();
  });
});

describe("updateProfile", () => {
  beforeEach(() => jest.clearAllMocks());

  it("updates first and last name", async () => {
    const updated = makeCustomer({ first_name: "Jane", last_name: "Smith" });
    mockExecute
      .mockResolvedValueOnce([[makeCustomer()]]) // findById existing
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // update
      .mockResolvedValueOnce([[updated]]); // findById after update

    const callback = jest.fn();
    await updateProfile(
      makeCall({
        customer_id: "cust-1",
        first_name: "Jane",
        last_name: "Smith",
      }),
      callback
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        customer: expect.objectContaining({
          first_name: "Jane",
          last_name: "Smith",
        }),
      })
    );
  });

  it("throws INVALID_ARGUMENT when customer_id missing", async () => {
    const callback = jest.fn();
    await expect(updateProfile(makeCall({}), callback)).rejects.toMatchObject({
      code: grpc.status.INVALID_ARGUMENT,
    });
  });

  it("throws NOT_FOUND when customer does not exist", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      updateProfile(
        makeCall({ customer_id: "ghost", first_name: "A" }),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.NOT_FOUND });
  });
});
