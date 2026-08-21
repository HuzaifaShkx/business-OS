import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { errorMiddleware } from './common/middleware/error.middleware.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { customerRouter } from './modules/customers/customer.routes.js';
import { conversationRouter } from './modules/conversations/conversation.routes.js';
import { orderRouter } from './modules/orders/order.routes.js';
import { taskRouter } from './modules/tasks/task.routes.js';
import { reviewRouter } from './modules/reviews/review.routes.js';
import { whatsAppRouter } from './modules/whatsapp/whatsapp.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';

export const app = express();

// Security Headers & CORS
app.use(helmet());
app.use(cors({
  origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'https://generous-connection-production-287a.up.railway.app'].filter(Boolean),
  credentials: true,
}));

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
});
app.use('/api', limiter);

// Health Check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString(), env: env.NODE_ENV });
});

// API Routes
app.use('/api', authRouter);
app.use('/api', customerRouter);
app.use('/api', conversationRouter);
app.use('/api', orderRouter);
app.use('/api', taskRouter);
app.use('/api', reviewRouter);
app.use('/api', whatsAppRouter);
app.use('/api', dashboardRouter);

// Centralized Error Handling
app.use(errorMiddleware);