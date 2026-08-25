import { Router } from 'express';
import { whatsAppController } from './whatsapp.controller.js';
import { simulatorController } from './simulator.controller.js';
import { requireAuth } from '../../common/middleware/auth.middleware.js';

export const whatsAppRouter = Router();

// Public Meta Webhook Endpoints
whatsAppRouter.get('/webhooks/whatsapp', (req, res, next) => whatsAppController.verifyWebhook(req, res).catch(next));
whatsAppRouter.post('/webhooks/whatsapp', (req, res, next) => whatsAppController.receiveWebhook(req, res, next));

// Protected Settings Endpoints
whatsAppRouter.get('/settings/whatsapp', requireAuth, (req, res, next) => whatsAppController.getSettings(req, res, next));
whatsAppRouter.post('/settings/whatsapp', requireAuth, (req, res, next) => whatsAppController.updateSettings(req, res, next));

// Protected Dev Simulator Endpoint
whatsAppRouter.post('/dev/simulate-message', requireAuth, (req, res, next) => simulatorController.simulateMessage(req, res, next));

// Protected Debug: Test outbound send
whatsAppRouter.post('/dev/test-send', requireAuth, async (req, res, next) => {
  try {
    const { to, text } = req.body;
    const businessId = (req as any).businessId!;

    if (!to || !text) {
      return res.status(400).json({ success: false, error: 'to and text are required' });
    }

    const { whatsAppService } = await import('./whatsapp.service.js');
    const { prisma } = await import('../../config/database.js');
    const config = await prisma.whatsAppConfig.findUnique({ where: { businessId } });

    const debugInfo = {
      phoneNumberId: config?.phoneNumberId || null,
      hasAccessToken: Boolean(config?.accessToken),
      accessTokenPreview: config?.accessToken ? config.accessToken.substring(0, 20) + '...' : 'NOT SET',
      to: to.replace(/\D/g, ''),
    };

    const sent = await whatsAppService.sendOutboundMessage(to, text, businessId);
    return res.json({ success: true, sent, debugInfo });
  } catch (error: any) {
    next(error);
  }
});