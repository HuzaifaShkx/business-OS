import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { sendSuccess } from '../../common/utils/response.js';
import { requireAuth } from '../../common/middleware/auth.middleware.js';

export class DashboardController {
  // GET /api/dashboard/overview
  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;

      const [
        totalCustomers,
        totalConversations,
        totalOrders,
        pendingOrders,
        pendingTasks,
        pendingReviews,
        recentConversations,
        recentOrders,
        recentTasks,
        pendingReviewItems,
      ] = await Promise.all([
        prisma.customer.count({ where: { businessId } }),
        prisma.conversation.count({ where: { businessId } }),
        prisma.order.count({ where: { businessId } }),
        prisma.order.count({
          where: {
            businessId,
            status: { in: ['NEW', 'AWAITING_CONFIRMATION', 'PROCESSING'] },
          },
        }),
        prisma.task.count({
          where: { businessId, status: 'PENDING' },
        }),
        prisma.reviewItem.count({
          where: { businessId, status: 'PENDING' },
        }),
        prisma.conversation.findMany({
          where: { businessId },
          take: 6,
          orderBy: { lastMessageAt: 'desc' },
          include: {
            customer: true,
            messages: {
              take: 1,
              orderBy: { timestamp: 'desc' },
            },
          },
        }),
        prisma.order.findMany({
          where: { businessId },
          take: 6,
          orderBy: { createdAt: 'desc' },
          include: { customer: true, items: true },
        }),
        prisma.task.findMany({
          where: { businessId, status: 'PENDING' },
          take: 6,
          orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
          include: { customer: true },
        }),
        prisma.reviewItem.findMany({
          where: { businessId, status: 'PENDING' },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { customer: true, message: true, conversation: true },
        }),
      ]);

      return sendSuccess(res, {
        stats: {
          totalCustomers,
          totalConversations,
          totalOrders,
          pendingOrders,
          pendingTasks,
          pendingReviews,
        },
        recentConversations,
        recentOrders,
        recentTasks,
        pendingReviewItems,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardRouter = Router();
const dashboardController = new DashboardController();

dashboardRouter.get('/dashboard/overview', requireAuth, (req, res, next) => dashboardController.getOverview(req, res, next));