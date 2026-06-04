import * as grpc from "@grpc/grpc-js";
import {
  ServiceError,
  Errors,
  grpcToHttp,
  handle,
} from "../../../shared/src/errors";

describe("ServiceError", () => {
  it("carries the correct gRPC code and message", () => {
    const err = new ServiceError(grpc.status.NOT_FOUND, "not found");
    expect(err.code).toBe(grpc.status.NOT_FOUND);
    expect(err.message).toBe("not found");
    expect(err.name).toBe("ServiceError");
  });
});

describe("Errors constructors", () => {
  it("notFound produces NOT_FOUND code", () => {
    expect(Errors.notFound("x").code).toBe(grpc.status.NOT_FOUND);
  });
  it("invalidArgument produces INVALID_ARGUMENT code", () => {
    expect(Errors.invalidArgument("x").code).toBe(grpc.status.INVALID_ARGUMENT);
  });
  it("permissionDenied produces PERMISSION_DENIED code", () => {
    expect(Errors.permissionDenied("x").code).toBe(
      grpc.status.PERMISSION_DENIED
    );
  });
  it("alreadyExists produces ALREADY_EXISTS code", () => {
    expect(Errors.alreadyExists("x").code).toBe(grpc.status.ALREADY_EXISTS);
  });
  it("unauthenticated produces UNAUTHENTICATED code", () => {
    expect(Errors.unauthenticated("x").code).toBe(grpc.status.UNAUTHENTICATED);
  });
  it("internal produces INTERNAL code", () => {
    expect(Errors.internal("x").code).toBe(grpc.status.INTERNAL);
  });
});

describe("grpcToHttp", () => {
  it("maps NOT_FOUND → 404", () => {
    expect(grpcToHttp[grpc.status.NOT_FOUND]).toBe(404);
  });
  it("maps INVALID_ARGUMENT → 400", () => {
    expect(grpcToHttp[grpc.status.INVALID_ARGUMENT]).toBe(400);
  });
  it("maps PERMISSION_DENIED → 403", () => {
    expect(grpcToHttp[grpc.status.PERMISSION_DENIED]).toBe(403);
  });
  it("maps UNAUTHENTICATED → 401", () => {
    expect(grpcToHttp[grpc.status.UNAUTHENTICATED]).toBe(401);
  });
  it("maps ALREADY_EXISTS → 409", () => {
    expect(grpcToHttp[grpc.status.ALREADY_EXISTS]).toBe(409);
  });
  it("maps INTERNAL → 500", () => {
    expect(grpcToHttp[grpc.status.INTERNAL]).toBe(500);
  });
});

describe("handle wrapper", () => {
  it("calls callback with ServiceError when thrown", async () => {
    const handler = handle(async (_call, _callback) => {
      throw Errors.notFound("item missing");
    });

    const callback = jest.fn();
    await handler({} as any, callback);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ code: grpc.status.NOT_FOUND }),
      null
    );
  });

  it("calls callback with INTERNAL on unknown error", async () => {
    const handler = handle(async (_call, _callback) => {
      throw new Error("something unexpected");
    });

    const callback = jest.fn();
    await handler({} as any, callback);

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ code: grpc.status.INTERNAL }),
      null
    );
  });
});
