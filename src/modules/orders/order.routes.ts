import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { sendSuccess } from '../../common/utils/response.js';
import { NotFoundError, BadRequestError } from '../../common/errors/app-error.js';
import { requireAuth } from '../../common/middleware/auth.middleware.js';

export class OrderController {
  // GET /api/orders
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const status = req.query.status as string;

      const orders = await prisma.order.findMany({
        where: {
          businessId,
          ...(status ? { status } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          items: true,
          conversation: {
            select: { id: true, channel: true },
          },
        },
      });

      return sendSuccess(res, orders);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/orders/:id
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const { id } = req.params;

      const order = await prisma.order.findFirst({
        where: { id, businessId },
        include: {
          customer: true,
          items: true,
          conversation: {
            include: {
              messages: {
                take: 5,
                orderBy: { timestamp: 'desc' },
              },
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      return sendSuccess(res, order);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/orders
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const { customerId, conversationId, totalAmount, paymentMethod, deliveryAddress, notes, items } = req.body;

      if (!customerId) {
        throw new BadRequestError('Customer ID is required');
      }

      const count = await prisma.order.count({ where: { businessId } });
      const orderNumber = `ORD-${1000 + count + 1}`;

      const order = await prisma.order.create({
        data: {
          businessId,
          customerId,
          conversationId,
          orderNumber,
          status: 'NEW',
          totalAmount: totalAmount ? parseFloat(totalAmount) : null,
          paymentMethod: paymentMethod || 'COD',
          deliveryAddress,
          notes,
          items: items && items.length > 0
            ? {
                create: items.map((i: any) => ({
                  productName: i.productName,
                  quantity: i.quantity || 1,
                  unitPrice: i.unitPrice ? parseFloat(i.unitPrice) : null,
                  notes: i.notes,
                })),
              }
            : undefined,
        },
        include: {
          items: true,
          customer: true,
        },
      });

      return sendSuccess(res, order, 'Order created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/orders/:id
  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const { id } = req.params;
      const { status, deliveryAddress, paymentMethod, notes } = req.body;

      const order = await prisma.order.findFirst({
        where: { id, businessId },
      });

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      const updated = await prisma.order.update({
        where: { id },
        data: {
          ...(status ? { status } : {}),
          ...(deliveryAddress !== undefined ? { deliveryAddress } : {}),
          ...(paymentMethod !== undefined ? { paymentMethod } : {}),
          ...(notes !== undefined ? { notes } : {}),
        },
        include: {
          customer: true,
          items: true,
        },
      });

      return sendSuccess(res, updated, 'Order updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const orderRouter = Router();
const orderController = new OrderController();

orderRouter.get('/orders', requireAuth, (req, res, next) => orderController.list(req, res, next));
orderRouter.get('/orders/:id', requireAuth, (req, res, next) => orderController.getById(req, res, next));
orderRouter.post('/orders', requireAuth, (req, res, next) => orderController.create(req, res, next));
orderRouter.patch('/orders/:id', requireAuth, (req, res, next) => orderController.updateStatus(req, res, next));