import { ZodSchema } from "zod";
import { BadRequestError } from "../errors";

// Validates + parses a gRPC request against a zod schema, returning the
// parsed (and coerced/defaulted) data. Throws BadRequestError on failure,
// which `handle()` in grpc-errors.ts maps to INVALID_ARGUMENT on the wire —
// same error shape the gateway's validate.middleware produces, so clients
// get consistent messages regardless of which layer rejected the request.
export function validateGrpc<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new BadRequestError(
      result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")
    );
  }
  return result.data;
}
