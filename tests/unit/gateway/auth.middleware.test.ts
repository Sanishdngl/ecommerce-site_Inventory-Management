import { generateKeyPairSync } from "crypto";
import * as jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import {
  adminAuthMiddleware,
  customerAuthMiddleware,
  requireRole,
} from "../../../gateway/src/middleware/auth.middleware";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, "\\n");
process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, "\\n");

function mockReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, ...overrides } as unknown as Request;
}

function mockRes(): { status: jest.Mock; json: jest.Mock } {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function validAdminToken(payload = { admin_id: "a1", role: "super_admin" }) {
  return jwt.sign(payload, privateKey, { algorithm: "RS256", expiresIn: "1h" });
}

function validCustomerToken(payload = { customer_id: "c1" }) {
  return jwt.sign(payload, privateKey, { algorithm: "RS256", expiresIn: "1h" });
}

describe("adminAuthMiddleware", () => {
  it("calls next() with valid token and attaches req.admin", () => {
    const req = mockReq({
      headers: { authorization: `Bearer ${validAdminToken()}` },
    });
    const res = mockRes();
    const next = jest.fn();

    adminAuthMiddleware(req as any, res as any, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect((req as any).admin.admin_id).toBe("a1");
    expect((req as any).admin.role).toBe("super_admin");
  });

  it("returns 401 when no authorization header", () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    adminAuthMiddleware(req as any, res as any, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token is malformed", () => {
    const req = mockReq({
      headers: { authorization: "Bearer notavalidtoken" },
    });
    const res = mockRes();
    const next = jest.fn();

    adminAuthMiddleware(req as any, res as any, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when header is not Bearer scheme", () => {
    const req = mockReq({ headers: { authorization: "Basic dXNlcjpwYXNz" } });
    const res = mockRes();
    const next = jest.fn();

    adminAuthMiddleware(req as any, res as any, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 401 for expired token", () => {
    const token = jwt.sign(
      { admin_id: "a1", role: "super_admin" },
      privateKey,
      { algorithm: "RS256", expiresIn: -1 }
    );

    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();

    adminAuthMiddleware(req as any, res as any, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe("customerAuthMiddleware", () => {
  it("calls next() with valid token and attaches req.customer", () => {
    const req = mockReq({
      headers: { authorization: `Bearer ${validCustomerToken()}` },
    });
    const res = mockRes();
    const next = jest.fn();

    customerAuthMiddleware(req as any, res as any, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect((req as any).customer.customer_id).toBe("c1");
  });

  it("returns 401 with no token", () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    customerAuthMiddleware(req as any, res as any, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe("requireRole", () => {
  it("calls next() when role matches", () => {
    const req = { admin: { admin_id: "a1", role: "super_admin" } };
    const res = mockRes();
    const next = jest.fn();

    requireRole("super_admin")(req as any, res as any, next as NextFunction);

    expect(next).toHaveBeenCalled();
  });

  it("returns 403 when role does not match", () => {
    const req = { admin: { admin_id: "a1", role: "reporter" } };
    const res = mockRes();
    const next = jest.fn();

    requireRole("super_admin")(req as any, res as any, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts any role in the allowed list", () => {
    const req = { admin: { admin_id: "a1", role: "maintainer" } };
    const res = mockRes();
    const next = jest.fn();

    requireRole("super_admin", "maintainer")(
      req as any,
      res as any,
      next as NextFunction
    );

    expect(next).toHaveBeenCalled();
  });

  it("returns 401 when req.admin is not set", () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();

    requireRole("super_admin")(req as any, res as any, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
