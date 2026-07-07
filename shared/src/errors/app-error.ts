export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL"
  | "UNAVAILABLE";

export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// Fallback for unknown errors or ones without a specific type
export class ServiceError extends AppError {
  readonly code: ErrorCode;
  constructor(message: string, code: ErrorCode = "INTERNAL") {
    super(message);
    this.code = code;
  }
}
