import * as grpc from "@grpc/grpc-js";
import { AppError, type ErrorCode } from "./app-error";
import { grpcToHttp } from "../constants/status";
import { logger } from "@infrastructure/observability/logger";

const SERVICE_NAME = process.env.SERVICE_NAME ?? "unknown-service";

// Code mapping tables
const CODE_TO_GRPC: Record<ErrorCode, grpc.status> = {
  BAD_REQUEST: grpc.status.INVALID_ARGUMENT,
  UNAUTHORIZED: grpc.status.UNAUTHENTICATED,
  FORBIDDEN: grpc.status.PERMISSION_DENIED,
  NOT_FOUND: grpc.status.NOT_FOUND,
  CONFLICT: grpc.status.ALREADY_EXISTS,
  INTERNAL: grpc.status.INTERNAL,
  UNAVAILABLE: grpc.status.UNAVAILABLE,
};

export { grpcToHttp };

// Converts AppError to gRPC format
export function toGrpcError(err: unknown): {
  code: grpc.status;
  message: string;
} {
  if (err instanceof AppError) {
    return { code: CODE_TO_GRPC[err.code], message: err.message };
  }
  return { code: grpc.status.INTERNAL, message: "Internal server error" };
}

function isDownstreamGrpcError(
  err: unknown
): err is { code: grpc.status; details: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    "details" in err &&
    typeof (err as any).code === "number" &&
    typeof (err as any).details === "string"
  );
}

type GrpcHandler<Req, Res> = (
  call: grpc.ServerUnaryCall<Req, Res>,
  callback: grpc.sendUnaryData<Res>
) => Promise<void>;

export function handle<Req, Res>(
  fn: GrpcHandler<Req, Res>
): GrpcHandler<Req, Res> {
  return async (call, callback) => {
    try {
      await fn(call, callback);
    } catch (err) {
      // Pass gRPC error code and message through
      if (isDownstreamGrpcError(err)) {
        callback(
          { code: (err as any).code, message: (err as any).details },
          null
        );
        return;
      }

      const wireErr = toGrpcError(err);

      // Log only unexpected errors — AppError is normal flow
      if (!(err instanceof AppError)) {
        logger.error(SERVICE_NAME, "Unhandled error in gRPC handler", {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }

      callback(wireErr, null);
    }
  };
}