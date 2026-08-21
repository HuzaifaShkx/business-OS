import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { sendSuccess } from '../../common/utils/response.js';
import { BadRequestError, UnauthorizedError, ConflictError } from '../../common/errors/app-error.js';
import { requireAuth } from '../../common/middleware/auth.middleware.js';
import { validateRequest } from '../../common/middleware/validation.middleware.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  businessName: z.string().min(2),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, name, businessName, phone } = req.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new ConflictError('A user with this email already exists');
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
        },
      });

      const business = await prisma.business.create({
        data: {
          name: businessName,
          ownerId: user.id,
          phone,
        },
      });

      await prisma.userBusiness.create({
        data: {
          userId: user.id,
          businessId: business.id,
          role: 'OWNER',
        },
      });

      // Default WhatsApp Config
      await prisma.whatsAppConfig.create({
        data: {
          businessId: business.id,
          verifyToken: env.WHATSAPP_VERIFY_TOKEN,
        },
      });

      const token = jwt.sign(
        { userId: user.id, businessId: business.id },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN as any }
      );

      return sendSuccess(res, {
        user: { id: user.id, email: user.email, name: user.name },
        business: { id: business.id, name: business.name, role: 'OWNER' },
        token,
      }, 'Registration successful', 201);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          businesses: {
            include: { business: true },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const primaryBusiness = user.businesses[0];
      if (!primaryBusiness) {
        throw new UnauthorizedError('User has no active workspace');
      }

      const token = jwt.sign(
        { userId: user.id, businessId: primaryBusiness.businessId },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN as any }
      );

      return sendSuccess(res, {
        user: { id: user.id, email: user.email, name: user.name },
        business: {
          id: primaryBusiness.business.id,
          name: primaryBusiness.business.name,
          role: primaryBusiness.role,
        },
        token,
      }, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        include: {
          businesses: {
            include: { business: true },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      const currentBusiness = user.businesses.find((b) => b.businessId === req.businessId) || user.businesses[0];

      return sendSuccess(res, {
        user: { id: user.id, email: user.email, name: user.name },
        business: {
          id: currentBusiness.business.id,
          name: currentBusiness.business.name,
          role: currentBusiness.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authRouter = Router();
const authController = new AuthController();

authRouter.post('/auth/register', validateRequest({ body: registerSchema }), (req, res, next) => authController.register(req, res, next));
authRouter.post('/auth/login', validateRequest({ body: loginSchema }), (req, res, next) => authController.login(req, res, next));
authRouter.get('/auth/me', requireAuth, (req, res, next) => authController.me(req, res, next));