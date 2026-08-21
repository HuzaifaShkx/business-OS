import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { BadRequestError } from '../errors/app-error.js';

export const validateRequest = (schema: { body?: AnyZodObject; query?: AnyZodObject; params?: AnyZodObject }) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new BadRequestError('Invalid request parameters', 'VALIDATION_ERROR', error.errors));
      } else {
        next(error);
      }
    }
  };
};