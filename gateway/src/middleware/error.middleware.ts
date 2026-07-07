import type { Request, Response, NextFunction } from "express";
import * as grpc from "@grpc/grpc-js";
import { AppError, grpcToHttp, toGrpcError } from "@shared/errors";
import { logger } from "@infrastructure/observability/logger";

const SERVICE_NAME = "gateway";

export function grpcErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof AppError) {
    const { code, message } = toGrpcError(err);
    res.status(grpcToHttp[code]).json({ message });
    return;
  }

  if (isGrpcError(err)) {
    const httpStatus = grpcToHttp[err.code as grpc.status] ?? 500;
    if (httpStatus >= 500) {
      logger.warn(SERVICE_NAME, "Downstream gRPC error surfaced to client", {
        method: req.method,
        path: req.originalUrl,
        grpc_code: err.code,
        message: err.details || err.message,
      });
    }
    res.status(httpStatus).json({ message: err.details || err.message });
    return;
  }

  logger.error(SERVICE_NAME, "Unhandled error in gateway", {
    method: req.method,
    path: req.originalUrl,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
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
