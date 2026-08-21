export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code?: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST', details?: unknown) {
    super(message, 400, code, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden access', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', code = 'CONFLICT') {
    super(message, 409, code);
  }
}