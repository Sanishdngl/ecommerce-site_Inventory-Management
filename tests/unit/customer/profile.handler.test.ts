const mockExecute = jest.fn();
jest.mock("@infrastructure/database/mysql", () => ({
  getDb: () => ({ execute: mockExecute }),
}));
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
    id: "11111111-1111-4111-8111-111111111111",
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
    await getProfile(
      makeCall({ customer_id: "11111111-1111-4111-8111-111111111111" }),
      callback
    );

    expect(callback).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        customer: expect.objectContaining({
          id: "11111111-1111-4111-8111-111111111111",
        }),
      })
    );
  });

  it("throws INVALID_ARGUMENT when customer_id missing", async () => {
    const callback = jest.fn();
    await expect(getProfile(makeCall({}), callback)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("throws NOT_FOUND when customer does not exist", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      getProfile(
        makeCall({ customer_id: "00000000-0000-4000-8000-000000000000" }),
        callback
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("does not expose password_hash", async () => {
    mockExecute.mockResolvedValueOnce([[makeCustomer()]]);

    const callback = jest.fn();
    await getProfile(
      makeCall({ customer_id: "11111111-1111-4111-8111-111111111111" }),
      callback
    );

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
        customer_id: "11111111-1111-4111-8111-111111111111",
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
      code: "BAD_REQUEST",
    });
  });

  it("throws NOT_FOUND when customer does not exist", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      updateProfile(
        makeCall({
          customer_id: "00000000-0000-4000-8000-000000000000",
          first_name: "A",
        }),
        callback
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
