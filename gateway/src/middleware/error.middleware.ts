import type { Request, Response, NextFunction } from "express";
import * as grpc from "@grpc/grpc-js";
import { grpcToHttp } from "@shared/errors";

export function grpcErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (isGrpcError(err)) {
    const httpStatus = grpcToHttp[err.code as grpc.status] ?? 500;
    res.status(httpStatus).json({ message: err.details || err.message });
    return;
  }

  console.error("[gateway] unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
}

function isGrpcError(err: unknown): err is grpc.ServiceError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as any).code === "number"
  );
}
