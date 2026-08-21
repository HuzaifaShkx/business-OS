import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { sendSuccess } from '../../common/utils/response.js';
import { NotFoundError } from '../../common/errors/app-error.js';
import { requireAuth } from '../../common/middleware/auth.middleware.js';

export class CustomerController {
  // GET /api/customers
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const search = (req.query.search as string) || '';
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '20', 10);
      const skip = (page - 1) * limit;

      const where = {
        businessId,
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { phoneNumber: { contains: search } },
                { address: { contains: search } },
              ],
            }
          : {}),
      };

      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          skip,
          take: limit,
          orderBy: { lastContactAt: 'desc' },
          include: {
            _count: {
              select: {
                orders: true,
                conversations: true,
                tasks: { where: { status: 'PENDING' } },
              },
            },
          },
        }),
        prisma.customer.count({ where }),
      ]);

      return sendSuccess(res, {
        customers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/customers/:id
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const { id } = req.params;

      const customer = await prisma.customer.findFirst({
        where: { id, businessId },
        include: {
          conversations: {
            orderBy: { lastMessageAt: 'desc' },
            include: {
              messages: {
                take: 10,
                orderBy: { timestamp: 'desc' },
              },
            },
          },
          orders: {
            orderBy: { createdAt: 'desc' },
            include: { items: true },
          },
          tasks: {
            orderBy: { dueAt: 'asc' },
          },
        },
      });

      if (!customer) {
        throw new NotFoundError('Customer not found');
      }

      return sendSuccess(res, customer);
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/customers/:id
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const { id } = req.params;
      const { name, address, email, notes } = req.body;

      const customer = await prisma.customer.findFirst({
        where: { id, businessId },
      });

      if (!customer) {
        throw new NotFoundError('Customer not found');
      }

      const updated = await prisma.customer.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(address !== undefined ? { address } : {}),
          ...(email !== undefined ? { email } : {}),
          ...(notes !== undefined ? { notes } : {}),
        },
      });

      return sendSuccess(res, updated, 'Customer updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const customerRouter = Router();
const customerController = new CustomerController();

customerRouter.use(requireAuth);
customerRouter.get('/customers', (req, res, next) => customerController.list(req, res, next));
customerRouter.get('/customers/:id', (req, res, next) => customerController.getById(req, res, next));
customerRouter.patch('/customers/:id', (req, res, next) => customerController.update(req, res, next));