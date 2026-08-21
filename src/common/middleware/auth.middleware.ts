import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { UnauthorizedError, ForbiddenError } from '../errors/app-error.js';
import { prisma } from '../../config/database.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  businessId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      businessId?: string;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token missing or invalid');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      userId: string;
      businessId?: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        businesses: {
          include: {
            business: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('User session expired or invalid');
    }

    const userBusiness = decoded.businessId
      ? user.businesses.find((b) => b.businessId === decoded.businessId)
      : user.businesses[0];

    if (!userBusiness) {
      throw new ForbiddenError('User is not associated with any active business workspace');
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      businessId: userBusiness.businessId,
      role: userBusiness.role,
    };
    req.businessId = userBusiness.businessId;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid authentication token'));
    } else {
      next(error);
    }
  }
}