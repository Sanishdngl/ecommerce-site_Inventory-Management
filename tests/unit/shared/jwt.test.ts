import * as jwt from "jsonwebtoken";
import { generateKeyPairSync } from "crypto";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, "\\n");
process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, "\\n");
process.env.JWT_EXPIRES_IN_ADMIN = "8h";
process.env.JWT_EXPIRES_IN_CUSTOMER = "24h";

import {
  signAdminJWT,
  verifyAdminJWT,
  signCustomerJWT,
  verifyCustomerJWT,
} from "../../../shared/src/auth/jwt";

describe("signAdminJWT / verifyAdminJWT", () => {
  it("signs and verifies a valid admin token", () => {
    const token = signAdminJWT({ admin_id: "abc-123", role: "super_admin" });
    const payload = verifyAdminJWT(token);

    expect(payload.admin_id).toBe("abc-123");
    expect(payload.role).toBe("super_admin");
    expect(payload.exp).toBeDefined();
  });

  it("throws on tampered token", () => {
    const token = signAdminJWT({ admin_id: "abc-123", role: "super_admin" });
    const tampered = token.slice(0, -5) + "XXXXX";
    expect(() => verifyAdminJWT(tampered)).toThrow();
  });

  it("throws on expired token", () => {
    const token = jwt.sign(
      { admin_id: "abc-123", role: "super_admin" },
      privateKey,
      { algorithm: "RS256", expiresIn: -1 }
    );
    expect(() => verifyAdminJWT(token)).toThrow();
  });
});

describe("signCustomerJWT / verifyCustomerJWT", () => {
  it("signs and verifies a valid customer token", () => {
    const token = signCustomerJWT({ customer_id: "cust-456" });
    const payload = verifyCustomerJWT(token);

    expect(payload.customer_id).toBe("cust-456");
    expect(payload.exp).toBeDefined();
  });

  it("throws when verified with wrong key", () => {
    const { privateKey: otherKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });

    const token = jwt.sign({ customer_id: "cust-456" }, otherKey, {
      algorithm: "RS256",
    });

    expect(() => verifyCustomerJWT(token)).toThrow();
  });
});
