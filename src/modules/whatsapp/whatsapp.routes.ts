import { Router } from 'express';
import { whatsAppController } from './whatsapp.controller.js';
import { simulatorController } from './simulator.controller.js';
import { requireAuth } from '../../common/middleware/auth.middleware.js';

export const whatsAppRouter = Router();

// Public Meta Webhook Endpoints
whatsAppRouter.get('/webhooks/whatsapp', (req, res) => whatsAppController.verifyWebhook(req, res));
whatsAppRouter.post('/webhooks/whatsapp', (req, res, next) => whatsAppController.receiveWebhook(req, res, next));

// Protected Settings Endpoints
whatsAppRouter.get('/settings/whatsapp', requireAuth, (req, res, next) => whatsAppController.getSettings(req, res, next));
whatsAppRouter.post('/settings/whatsapp', requireAuth, (req, res, next) => whatsAppController.updateSettings(req, res, next));

// Protected Dev Simulator Endpoint
whatsAppRouter.post('/dev/simulate-message', requireAuth, (req, res, next) => simulatorController.simulateMessage(req, res, next));