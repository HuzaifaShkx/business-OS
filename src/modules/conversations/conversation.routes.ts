import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { sendSuccess } from '../../common/utils/response.js';
import { NotFoundError, BadRequestError } from '../../common/errors/app-error.js';
import { requireAuth } from '../../common/middleware/auth.middleware.js';

export class ConversationController {
  // GET /api/conversations
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const status = req.query.status as string;

      const conversations = await prisma.conversation.findMany({
        where: {
          businessId,
          ...(status ? { status } : {}),
        },
        orderBy: { lastMessageAt: 'desc' },
        include: {
          customer: true,
          messages: {
            take: 1,
            orderBy: { timestamp: 'desc' },
          },
          orders: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: { messages: true, orders: true, tasks: true },
          },
        },
      });

      return sendSuccess(res, conversations);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/conversations/:id
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const { id } = req.params;

      const conversation = await prisma.conversation.findFirst({
        where: { id, businessId },
        include: {
          customer: true,
          messages: {
            orderBy: { timestamp: 'asc' },
            include: {
              reviewItem: true,
            },
          },
          orders: {
            orderBy: { createdAt: 'desc' },
            include: { items: true },
          },
          tasks: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }

      return sendSuccess(res, conversation);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/conversations/:id/messages (Outbound reply)
  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const { id } = req.params;
      const { text } = req.body;

      if (!text || typeof text !== 'string') {
        throw new BadRequestError('Message text is required');
      }

      const conversation = await prisma.conversation.findFirst({
        where: { id, businessId },
        include: { customer: true },
      });

      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }

      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'OUTBOUND',
          sender: req.user!.name || 'Business',
          messageType: 'TEXT',
          text,
          externalMessageId: `out-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          timestamp: new Date(),
          aiProcessed: true,
          rawPayload: JSON.stringify({ direction: 'OUTBOUND', senderId: req.user!.id }),
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      return sendSuccess(res, message, 'Message sent successfully', 201);
    } catch (error) {
      next(error);
    }
  }
}

export const conversationRouter = Router();
const conversationController = new ConversationController();

conversationRouter.get('/conversations', requireAuth, (req, res, next) => conversationController.list(req, res, next));
conversationRouter.get('/conversations/:id', requireAuth, (req, res, next) => conversationController.getById(req, res, next));
conversationRouter.post('/conversations/:id/messages', requireAuth, (req, res, next) => conversationController.sendMessage(req, res, next));