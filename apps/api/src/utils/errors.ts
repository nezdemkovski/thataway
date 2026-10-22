/**
 * Base application error class. Services throw these; the global error handler in
 * src/index.ts turns them into `{ error, message }` responses.
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorType: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  readonly statusCode = 400;
  readonly errorType = "Bad Request";

  constructor(message: string = "Bad request") {
    super(message);
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly errorType = "Not Found";

  constructor(message: string = "Resource not found") {
    super(message);
  }
}

export class TooManyRequestsError extends AppError {
  readonly statusCode = 429;
  readonly errorType = "Too Many Requests";

  constructor(
    message: string = "Too many requests",
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export class ServiceUnavailableError extends AppError {
  readonly statusCode = 503;
  readonly errorType = "Service Unavailable";

  constructor(message: string = "Service unavailable") {
    super(message);
  }
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly errorType = "Unauthorized";

  constructor(message: string = "Authentication required") {
    super(message);
  }
}
