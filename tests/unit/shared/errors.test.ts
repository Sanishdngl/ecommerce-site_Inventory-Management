import * as grpc from "@grpc/grpc-js";
import {
  ServiceError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  toGrpcError,
  grpcToHttp,
  handle,
} from "../../../shared/src/errors";

describe("ServiceError", () => {
  it("carries the given message and code", () => {
    const err = new ServiceError("not found", "NOT_FOUND");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("not found");
    expect(err.name).toBe("ServiceError");
  });

  it("defaults to INTERNAL when no code is given", () => {
    const err = new ServiceError("boom");
    expect(err.code).toBe("INTERNAL");
  });
});

describe("toGrpcError", () => {
  it("maps NotFoundError to NOT_FOUND", () => {
    expect(toGrpcError(new NotFoundError("x")).code).toBe(
      grpc.status.NOT_FOUND
    );
  });
  it("maps BadRequestError to INVALID_ARGUMENT", () => {
    expect(toGrpcError(new BadRequestError("x")).code).toBe(
      grpc.status.INVALID_ARGUMENT
    );
  });
  it("maps ForbiddenError to PERMISSION_DENIED", () => {
    expect(toGrpcError(new ForbiddenError("x")).code).toBe(
      grpc.status.PERMISSION_DENIED
    );
  });
  it("maps ConflictError to ALREADY_EXISTS", () => {
    expect(toGrpcError(new ConflictError("x")).code).toBe(
      grpc.status.ALREADY_EXISTS
    );
  });
  it("maps UnauthorizedError to UNAUTHENTICATED", () => {
    expect(toGrpcError(new UnauthorizedError("x")).code).toBe(
      grpc.status.UNAUTHENTICATED
    );
  });
  it("maps non-AppError instances to INTERNAL", () => {
    expect(toGrpcError(new Error("unexpected")).code).toBe(
      grpc.status.INTERNAL
    );
  });
});

describe("grpcToHttp", () => {
  it("maps NOT_FOUND to 404", () => {
    expect(grpcToHttp[grpc.status.NOT_FOUND]).toBe(404);
  });
  it("maps INVALID_ARGUMENT to 400", () => {
    expect(grpcToHttp[grpc.status.INVALID_ARGUMENT]).toBe(400);
  });
  it("maps PERMISSION_DENIED to 403", () => {
    expect(grpcToHttp[grpc.status.PERMISSION_DENIED]).toBe(403);
  });
  it("maps UNAUTHENTICATED to 401", () => {
    expect(grpcToHttp[grpc.status.UNAUTHENTICATED]).toBe(401);
  });
  it("maps ALREADY_EXISTS to 409", () => {
    expect(grpcToHttp[grpc.status.ALREADY_EXISTS]).toBe(409);
  });
  it("maps INTERNAL to 500", () => {
    expect(grpcToHttp[grpc.status.INTERNAL]).toBe(500);
  });
});

describe("handle wrapper", () => {
  it("calls callback with the mapped gRPC code when an AppError is thrown", async () => {
    const handler = handle(async (_call, _callback) => {
      throw new NotFoundError("item missing");
    });

    const callback = jest.fn();
    await handler({} as any, callback);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ code: grpc.status.NOT_FOUND }),
      null
    );
  });

  it("calls callback with INTERNAL on an unknown error", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const handler = handle(async (_call, _callback) => {
      throw new Error("something unexpected");
    });

    const callback = jest.fn();
    await handler({} as any, callback);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ code: grpc.status.INTERNAL }),
      null
    );

    consoleSpy.mockRestore();
  });
});
