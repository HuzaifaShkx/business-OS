import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { sendSuccess } from '../../common/utils/response.js';
import { NotFoundError, BadRequestError } from '../../common/errors/app-error.js';
import { requireAuth } from '../../common/middleware/auth.middleware.js';

export class TaskController {
  // GET /api/tasks
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const status = req.query.status as string;
      const priority = req.query.priority as string;

      const tasks = await prisma.task.findMany({
        where: {
          businessId,
          ...(status ? { status } : {}),
          ...(priority ? { priority } : {}),
        },
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
        include: {
          customer: true,
          conversation: { select: { id: true, channel: true } },
        },
      });

      return sendSuccess(res, tasks);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/tasks
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const { customerId, conversationId, title, description, dueAt, priority } = req.body;

      if (!title) {
        throw new BadRequestError('Task title is required');
      }

      const task = await prisma.task.create({
        data: {
          businessId,
          customerId,
          conversationId,
          title,
          description,
          dueAt: dueAt ? new Date(dueAt) : null,
          priority: priority || 'MEDIUM',
          status: 'PENDING',
          source: 'manual',
        },
        include: { customer: true },
      });

      return sendSuccess(res, task, 'Task created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/tasks/:id
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const { id } = req.params;
      const { status, title, description, dueAt, priority } = req.body;

      const task = await prisma.task.findFirst({
        where: { id, businessId },
      });

      if (!task) {
        throw new NotFoundError('Task not found');
      }

      const updated = await prisma.task.update({
        where: { id },
        data: {
          ...(status ? { status } : {}),
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(dueAt !== undefined ? { dueAt: dueAt ? new Date(dueAt) : null } : {}),
          ...(priority !== undefined ? { priority } : {}),
        },
        include: { customer: true },
      });

      return sendSuccess(res, updated, 'Task updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const taskRouter = Router();
const taskController = new TaskController();

taskRouter.get('/tasks', requireAuth, (req, res, next) => taskController.list(req, res, next));
taskRouter.post('/tasks', requireAuth, (req, res, next) => taskController.create(req, res, next));
taskRouter.patch('/tasks/:id', requireAuth, (req, res, next) => taskController.update(req, res, next));