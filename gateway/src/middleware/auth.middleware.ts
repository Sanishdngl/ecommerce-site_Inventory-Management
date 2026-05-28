import type { Request, Response, NextFunction } from "express";
import { verifyAdminJWT, verifyCustomerJWT } from "@shared/jwt";
import type { AdminRole } from "@shared/types";

export function adminAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
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
      res.status(403).json({ message: "Insufficient permissions" });
      return;
    }

    next();
  };
}
