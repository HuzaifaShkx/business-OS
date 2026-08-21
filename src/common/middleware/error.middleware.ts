import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error.js';
import { sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { ZodError } from 'zod';

export function errorMiddleware(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error(`Unhandled AppError: ${err.message}`, { stack: err.stack });
    }
    return sendError(res, err.message, err.statusCode, err.code || 'APP_ERROR', err.details);
  }

  if (err instanceof ZodError) {
    return sendError(res, 'Validation failed', 400, 'VALIDATION_ERROR', err.format());
  }

  logger.error(`Unexpected Server Error: ${err.message}`, { stack: err.stack, path: req.path });
  return sendError(res, 'An unexpected internal error occurred', 500, 'INTERNAL_SERVER_ERROR');
}