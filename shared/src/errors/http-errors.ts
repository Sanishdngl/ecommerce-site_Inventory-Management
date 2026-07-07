import { AppError, type ErrorCode } from "./app-error";

export class BadRequestError extends AppError {
  readonly code: ErrorCode = "BAD_REQUEST";
}

export class UnauthorizedError extends AppError {
  readonly code: ErrorCode = "UNAUTHORIZED";
}

export class ForbiddenError extends AppError {
  readonly code: ErrorCode = "FORBIDDEN";
}

export class NotFoundError extends AppError {
  readonly code: ErrorCode = "NOT_FOUND";
}

export class ConflictError extends AppError {
  readonly code: ErrorCode = "CONFLICT";
}
