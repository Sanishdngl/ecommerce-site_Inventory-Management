import type { AdminJWTPayload, CustomerJWTPayload } from "@shared/types";

declare global {
  namespace Express {
    interface Request {
      admin?: AdminJWTPayload;
      customer?: CustomerJWTPayload;
    }
  }
}

export {};
