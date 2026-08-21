import { Response } from 'express';

export interface ApiResponseEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function sendSuccess<T>(res: Response, data: T, message?: string, statusCode = 200) {
  const payload: ApiResponseEnvelope<T> = {
    success: true,
    data,
    ...(message ? { message } : {}),
  };
  return res.status(statusCode).json(payload);
}

export function sendError(res: Response, message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
  const payload: ApiResponseEnvelope<null> = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
  return res.status(statusCode).json(payload);
}