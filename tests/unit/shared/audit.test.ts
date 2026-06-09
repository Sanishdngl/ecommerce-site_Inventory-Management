const mockExecute = jest.fn();
jest.mock("@shared/db", () => ({ getDb: () => ({ execute: mockExecute }) }));

import { writeAuditLog } from "../../../shared/src/audit";

const baseEntry = {
  entity_type: "product" as const,
  entity_id: "prod-1",
  action: "create" as const,
  performed_by: "admin-1",
};

describe("writeAuditLog", () => {
  beforeEach(() => jest.clearAllMocks());

  it("inserts audit log with correct fields", async () => {
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const db = { execute: mockExecute } as any;
    await writeAuditLog(db, {
      ...baseEntry,
      metadata: { key: "val" },
      ip_address: "127.0.0.1",
    });

    expect(mockExecute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO audit_logs"),
      expect.arrayContaining([
        expect.any(String), // uuid
        "product",
        "prod-1",
        "create",
        "admin-1",
        JSON.stringify({ key: "val" }),
        "127.0.0.1",
      ])
    );
  });

  it("inserts null for optional fields when not provided", async () => {
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const db = { execute: mockExecute } as any;
    await writeAuditLog(db, baseEntry);

    const args = mockExecute.mock.calls[0][1];
    expect(args[5]).toBeNull(); // metadata
    expect(args[6]).toBeNull(); // ip_address
  });

  it("swallows DB errors silently without throwing", async () => {
    mockExecute.mockRejectedValueOnce(new Error("DB connection lost"));
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const db = { execute: mockExecute } as any;
    await expect(writeAuditLog(db, baseEntry)).resolves.toBeUndefined();

    consoleSpy.mockRestore();
  });

  it("serializes metadata as JSON string", async () => {
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const db = { execute: mockExecute } as any;
    const metadata = { diff: { name: { from: "A", to: "B" } } };
    await writeAuditLog(db, { ...baseEntry, metadata });

    const args = mockExecute.mock.calls[0][1];
    expect(args[5]).toBe(JSON.stringify(metadata));
  });
});
