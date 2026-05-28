import * as grpc from "@grpc/grpc-js";

export class ServiceError extends Error {
  constructor(public readonly code: grpc.status, message: string) {
    super(message);
    this.name = "ServiceError";
  }
}

export const Errors = {
  notFound: (msg: string) => new ServiceError(grpc.status.NOT_FOUND, msg),
  invalidArgument: (msg: string) =>
    new ServiceError(grpc.status.INVALID_ARGUMENT, msg),
  permissionDenied: (msg: string) =>
    new ServiceError(grpc.status.PERMISSION_DENIED, msg),
  alreadyExists: (msg: string) =>
    new ServiceError(grpc.status.ALREADY_EXISTS, msg),
  internal: (msg: string) => new ServiceError(grpc.status.INTERNAL, msg),
  unauthenticated: (msg: string) =>
    new ServiceError(grpc.status.UNAUTHENTICATED, msg),
} as const;

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
      if (err instanceof ServiceError) {
        callback({ code: err.code, message: err.message }, null);
      } else {
        console.error("[grpc] unhandled error:", err);
        callback(
          { code: grpc.status.INTERNAL, message: "Internal server error" },
          null
        );
      }
    }
  };
}

export const grpcToHttp: Record<grpc.status, number> = {
  [grpc.status.OK]: 200,
  [grpc.status.CANCELLED]: 499,
  [grpc.status.UNKNOWN]: 500,
  [grpc.status.INVALID_ARGUMENT]: 400,
  [grpc.status.DEADLINE_EXCEEDED]: 504,
  [grpc.status.NOT_FOUND]: 404,
  [grpc.status.ALREADY_EXISTS]: 409,
  [grpc.status.PERMISSION_DENIED]: 403,
  [grpc.status.RESOURCE_EXHAUSTED]: 429,
  [grpc.status.FAILED_PRECONDITION]: 400,
  [grpc.status.ABORTED]: 409,
  [grpc.status.OUT_OF_RANGE]: 400,
  [grpc.status.UNIMPLEMENTED]: 501,
  [grpc.status.INTERNAL]: 500,
  [grpc.status.UNAVAILABLE]: 503,
  [grpc.status.DATA_LOSS]: 500,
  [grpc.status.UNAUTHENTICATED]: 401,
};
