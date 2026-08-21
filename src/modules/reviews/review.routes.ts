import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { sendSuccess } from '../../common/utils/response.js';
import { NotFoundError, BadRequestError } from '../../common/errors/app-error.js';
import { requireAuth } from '../../common/middleware/auth.middleware.js';

export class ReviewController {
  // GET /api/reviews
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const status = (req.query.status as string) || 'PENDING';

      const reviews = await prisma.reviewItem.findMany({
        where: {
          businessId,
          ...(status !== 'ALL' ? { status } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          conversation: true,
          message: true,
        },
      });

      return sendSuccess(res, reviews);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/reviews/:id/approve
  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const { id } = req.params;

      const review = await prisma.reviewItem.findFirst({
        where: { id, businessId },
        include: { customer: true, conversation: true, message: true },
      });

      if (!review) {
        throw new NotFoundError('Review item not found');
      }

      if (review.status !== 'PENDING') {
        throw new BadRequestError('Review item is already resolved');
      }

      const suggestedData = JSON.parse(review.suggestedData || '{}');
      let createdEntity: any = null;
      const msgText = review.message?.text || '';

      // If review type was order creation
      if (review.reviewType === 'ORDER_CREATION' || suggestedData.detectedIntent === 'new_order') {
        const count = await prisma.order.count({ where: { businessId } });
        const orderNumber = `ORD-${1000 + count + 1}`;
        const entities = suggestedData.entities || {};

        createdEntity = await prisma.order.create({
          data: {
            businessId,
            customerId: review.customerId || (review.customer?.id)!,
            conversationId: review.conversationId,
            orderNumber,
            status: 'AWAITING_CONFIRMATION',
            totalAmount: entities.price || 3500,
            paymentMethod: entities.payment_method || 'COD',
            deliveryAddress: entities.address || review.customer?.address,
            notes: `Approved by human reviewer. Source message: "${msgText}"`,
            items: {
              create: [
                {
                  productName: entities.product_name || 'Standard Product',
                  quantity: entities.quantity || 1,
                  unitPrice: entities.price || 3500,
                  notes: entities.size ? `Size: ${entities.size}` : undefined,
                },
              ],
            },
          },
          include: { items: true },
        });
      } else {
        // Create Follow-up Task
        createdEntity = await prisma.task.create({
          data: {
            businessId,
            customerId: review.customerId,
            conversationId: review.conversationId,
            title: `Follow up: ${msgText.substring(0, 40)}...`,
            description: msgText,
            dueAt: new Date(Date.now() + 86400000),
            priority: 'MEDIUM',
            status: 'PENDING',
            source: 'human_reviewed',
          },
        });
      }

      const updatedReview = await prisma.reviewItem.update({
        where: { id },
        data: {
          status: 'APPROVED',
          resolvedAt: new Date(),
          reviewerNotes: 'Approved as suggested',
        },
      });

      return sendSuccess(res, { review: updatedReview, createdEntity }, 'Review item approved and entity created');
    } catch (error) {
      next(error);
    }
  }

  // POST /api/reviews/:id/reject
  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const { id } = req.params;
      const { notes } = req.body;

      const review = await prisma.reviewItem.findFirst({
        where: { id, businessId },
      });

      if (!review) {
        throw new NotFoundError('Review item not found');
      }

      const updated = await prisma.reviewItem.update({
        where: { id },
        data: {
          status: 'REJECTED',
          resolvedAt: new Date(),
          reviewerNotes: notes || 'Rejected by human reviewer',
        },
      });

      return sendSuccess(res, updated, 'Review item rejected');
    } catch (error) {
      next(error);
    }
  }

  // POST /api/reviews/:id/edit
  async editAndApprove(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const { id } = req.params;
      const { intent, productName, quantity, price, deliveryAddress, paymentMethod, notes } = req.body;

      const review = await prisma.reviewItem.findFirst({
        where: { id, businessId },
        include: { customer: true, message: true },
      });

      if (!review) {
        throw new NotFoundError('Review item not found');
      }

      let createdEntity: any = null;
      const msgText = review.message?.text || '';

      if (intent === 'new_order' || !intent) {
        const count = await prisma.order.count({ where: { businessId } });
        const orderNumber = `ORD-${1000 + count + 1}`;

        createdEntity = await prisma.order.create({
          data: {
            businessId,
            customerId: review.customerId || (review.customer?.id)!,
            conversationId: review.conversationId,
            orderNumber,
            status: 'CONFIRMED',
            totalAmount: price ? parseFloat(price) : (quantity ? quantity * 2500 : 2500),
            paymentMethod: paymentMethod || 'COD',
            deliveryAddress: deliveryAddress || review.customer?.address,
            notes: notes || `Created via review editor from message: "${msgText}"`,
            items: {
              create: [
                {
                  productName: productName || 'Custom Product',
                  quantity: quantity ? parseInt(quantity, 10) : 1,
                  unitPrice: price ? parseFloat(price) : 2500,
                },
              ],
            },
          },
          include: { items: true },
        });
      }

      const updated = await prisma.reviewItem.update({
        where: { id },
        data: {
          status: 'EDITED_AND_APPROVED',
          resolvedAt: new Date(),
          reviewerNotes: `Edited and approved by user. ${notes || ''}`,
        },
      });

      return sendSuccess(res, { review: updated, createdEntity }, 'Review updated and entity created');
    } catch (error) {
      next(error);
    }
  }
}

export const reviewRouter = Router();
const reviewController = new ReviewController();

reviewRouter.use(requireAuth);
reviewRouter.get('/reviews', (req, res, next) => reviewController.list(req, res, next));
reviewRouter.post('/reviews/:id/approve', (req, res, next) => reviewController.approve(req, res, next));
reviewRouter.post('/reviews/:id/reject', (req, res, next) => reviewController.reject(req, res, next));
reviewRouter.post('/reviews/:id/edit', (req, res, next) => reviewController.editAndApprove(req, res, next));