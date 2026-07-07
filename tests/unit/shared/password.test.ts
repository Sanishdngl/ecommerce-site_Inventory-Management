import {
  hashPassword,
  verifyPassword,
} from "../../../shared/src/auth/password";

describe("hashPassword", () => {
  it("produces a bcrypt hash", async () => {
    const hash = await hashPassword("secret123");
    expect(hash).toMatch(/^\$2b\$/);
  });

  it("produces different hashes for the same input", async () => {
    const hash1 = await hashPassword("secret123");
    const hash2 = await hashPassword("secret123");
    expect(hash1).not.toBe(hash2);
  });
});

describe("verifyPassword", () => {
  it("returns true for matching password", async () => {
    const hash = await hashPassword("mypassword");
    const valid = await verifyPassword("mypassword", hash);
    expect(valid).toBe(true);
  });

  it("returns false for wrong password", async () => {
    const hash = await hashPassword("mypassword");
    const valid = await verifyPassword("wrongpassword", hash);
    expect(valid).toBe(false);
  });
});
