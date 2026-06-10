import * as grpc from "@grpc/grpc-js";

const mockExecute = jest.fn();
jest.mock("@shared/db", () => ({
  getDb: () => ({ execute: mockExecute }),
}));

jest.mock("@shared/audit", () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@shared/password", () => ({
  hashPassword: jest
    .fn()
    .mockResolvedValue("'TEST_HASH_NOT_A_REAL_BCRYPT_VALUE'"),
  verifyPassword: jest.fn(),
}));

jest.mock("@shared/errors", () => {
  const actual = jest.requireActual("@shared/errors");
  return {
    ...actual,
    handle: (fn: any) => fn,
  };
});

import { verifyPassword } from "@shared/password";
import { writeAuditLog } from "@shared/audit";
import {
  loginAdmin,
  createAdminUser,
  updateAdminUser,
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
      makeCall({ username: "testadmin", password: "pass123" }),
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
    ).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
  });

  it("throws UNAUTHENTICATED when user not found", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      loginAdmin(makeCall({ username: "nobody", password: "pass" }), callback)
    ).rejects.toMatchObject({ code: grpc.status.UNAUTHENTICATED });
  });

  it("throws UNAUTHENTICATED when user is inactive", async () => {
    mockExecute.mockResolvedValueOnce([[makeAdminUser({ is_active: false })]]);

    const callback = jest.fn();
    await expect(
      loginAdmin(
        makeCall({ username: "testadmin", password: "pass" }),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.UNAUTHENTICATED });
  });

  it("throws UNAUTHENTICATED on wrong password", async () => {
    mockExecute.mockResolvedValueOnce([[makeAdminUser()]]);
    (verifyPassword as jest.Mock).mockResolvedValueOnce(false);

    const callback = jest.fn();
    await expect(
      loginAdmin(
        makeCall({ username: "testadmin", password: "wrong" }),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.UNAUTHENTICATED });
  });

  it("does not expose password_hash in response", async () => {
    mockExecute.mockResolvedValueOnce([[makeAdminUser()]]);
    (verifyPassword as jest.Mock).mockResolvedValueOnce(true);

    const callback = jest.fn();
    await loginAdmin(
      makeCall({ username: "testadmin", password: "pass" }),
      callback
    );

    const returned = callback.mock.calls[0][1];
    expect(returned.user.password_hash).toBeUndefined();
  });
});

describe("createAdminUser", () => {
  beforeEach(() => jest.clearAllMocks());

  const meta = { admin_id: "super-1", role: "super_admin" };

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
          password: "pass123",
          role: "maintainer",
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
            password: "pass",
            role: "maintainer",
          },
          { admin_id: "a1", role: "maintainer" }
        ),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.PERMISSION_DENIED });
  });

  it("throws INVALID_ARGUMENT when required fields missing", async () => {
    const callback = jest.fn();
    await expect(
      createAdminUser(
        makeCall({ username: "", email: "", password: "", role: "" }, meta),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
  });

  it("throws INVALID_ARGUMENT when role is super_admin", async () => {
    const callback = jest.fn();
    await expect(
      createAdminUser(
        makeCall(
          {
            username: "x",
            email: "x@x.com",
            password: "pass",
            role: "super_admin",
          },
          meta
        ),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.INVALID_ARGUMENT });
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
            password: "pass",
            role: "maintainer",
          },
          meta
        ),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.ALREADY_EXISTS });
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
            password: "pass",
            role: "maintainer",
          },
          meta
        ),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.ALREADY_EXISTS });
  });
});

describe("deleteAdminUser", () => {
  beforeEach(() => jest.clearAllMocks());

  const meta = { admin_id: "super-1", role: "super_admin" };

  it("deletes user and writes audit log", async () => {
    const user = makeAdminUser({ id: "target-1" });
    mockExecute
      .mockResolvedValueOnce([[user]]) // findById
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // delete

    const callback = jest.fn();
    await deleteAdminUser(makeCall({ id: "target-1" }, meta), callback);

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
    const user = makeAdminUser({ id: "super-1" });
    mockExecute.mockResolvedValueOnce([[user]]);

    const callback = jest.fn();
    await expect(
      deleteAdminUser(makeCall({ id: "super-1" }, meta), callback)
    ).rejects.toMatchObject({ code: grpc.status.PERMISSION_DENIED });
  });

  it("throws NOT_FOUND when user does not exist", async () => {
    mockExecute.mockResolvedValueOnce([[]]);

    const callback = jest.fn();
    await expect(
      deleteAdminUser(makeCall({ id: "ghost" }, meta), callback)
    ).rejects.toMatchObject({ code: grpc.status.NOT_FOUND });
  });

  it("throws PERMISSION_DENIED when caller is not super_admin", async () => {
    const callback = jest.fn();
    await expect(
      deleteAdminUser(
        makeCall({ id: "target-1" }, { admin_id: "a1", role: "maintainer" }),
        callback
      )
    ).rejects.toMatchObject({ code: grpc.status.PERMISSION_DENIED });
  });
});

describe("toggleAdminStatus", () => {
  beforeEach(() => jest.clearAllMocks());

  const meta = { admin_id: "super-1", role: "super_admin" };

  it("toggles status and writes audit log with before/after", async () => {
    const user = makeAdminUser({ id: "target-1", is_active: true });
    mockExecute
      .mockResolvedValueOnce([[user]]) //findById
      .mockResolvedValueOnce([{ affectedRows: 1 }]) //toggle update
      .mockResolvedValueOnce([[user]]); // findById inside

    const callback = jest.fn();
    await toggleAdminStatus(makeCall({ id: "target-1" }, meta), callback);

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: { is_active: { from: true, to: false } },
      })
    );
  });

  it("throws PERMISSION_DENIED when toggling own account", async () => {
    const user = makeAdminUser({ id: "super-1" });
    mockExecute.mockResolvedValueOnce([[user]]);

    const callback = jest.fn();
    await expect(
      toggleAdminStatus(makeCall({ id: "super-1" }, meta), callback)
    ).rejects.toMatchObject({ code: grpc.status.PERMISSION_DENIED });
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
