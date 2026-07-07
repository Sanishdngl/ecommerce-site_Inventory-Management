import type { Request, Response, NextFunction } from "express";
import { verifyAdminJWT, verifyCustomerJWT } from "@shared/auth/jwt";
import type { AdminRole } from "@shared/types";
import { logger } from "@infrastructure/observability/logger";

const SERVICE_NAME = "gateway";

export function adminAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    logger.warn(SERVICE_NAME, "Admin request missing bearer token", {
      path: req.originalUrl,
      ip: req.ip,
    });
    res
      .status(401)
      .json({ message: "Missing or malformed authorization header" });
    return;
  }

  const token = header.slice(7);

  try {
    req.admin = verifyAdminJWT(token);
    next();
  } catch {
    logger.warn(SERVICE_NAME, "Admin request with invalid or expired token", {
      path: req.originalUrl,
      ip: req.ip,
    });
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function customerAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    logger.warn(SERVICE_NAME, "Customer request missing bearer token", {
      path: req.originalUrl,
      ip: req.ip,
    });
    res
      .status(401)
      .json({ message: "Missing or malformed authorization header" });
    return;
  }

  const token = header.slice(7);

  try {
    req.customer = verifyCustomerJWT(token);
    next();
  } catch {
    logger.warn(
      SERVICE_NAME,
      "Customer request with invalid or expired token",
      { path: req.originalUrl, ip: req.ip }
    );
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireRole(...roles: AdminRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({ message: "Unauthenticated" });
      return;
    }

    if (!roles.includes(req.admin.role)) {
      logger.warn(SERVICE_NAME, "Admin denied by role check", {
        path: req.originalUrl,
        admin_id: req.admin.admin_id,
        role: req.admin.role,
        required_roles: roles,
      });
      res.status(403).json({ message: "Insufficient permissions" });
      return;
    }

    next();
  };
}
