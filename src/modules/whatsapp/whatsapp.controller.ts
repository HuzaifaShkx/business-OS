import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env.js';
import { normalizeMetaWebhookPayload } from './whatsapp.normalizer.js';
import { whatsAppService } from './whatsapp.service.js';
import { prisma } from '../../config/database.js';
import { logger } from '../../common/utils/logger.js';
import { sendSuccess } from '../../common/utils/response.js';

export class WhatsAppController {
  // GET /api/webhooks/whatsapp - Meta Verification Handshake
  verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
      logger.info('Meta WhatsApp Webhook successfully verified');
      return res.status(200).send(challenge);
    }

    logger.warn('Meta Webhook verification failed. Tokens did not match.');
    return res.status(403).json({ error: 'Verification token mismatch' });
  }

  // POST /api/webhooks/whatsapp - Inbound Event Receiver
  async receiveWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const messages = normalizeMetaWebhookPayload(req.body);

      // Respond immediately to Meta to prevent timeout retries
      res.status(200).json({ status: 'received' });

      for (const msg of messages) {
        // Look up business associated with this WhatsApp config
        let business = null;
        if (msg.phoneNumberId) {
          const config = await prisma.whatsAppConfig.findFirst({
            where: { phoneNumberId: msg.phoneNumberId },
            include: { business: true },
          });
          business = config?.business;
        }

        // Fallback to first business in dev
        if (!business) {
          business = await prisma.business.findFirst();
        }

        if (business) {
          await whatsAppService.processIncomingMessage(msg, business.id);
        } else {
          logger.warn('No active business found to route incoming WhatsApp webhook.');
        }
      }
    } catch (error) {
      logger.error('Error handling WhatsApp webhook payload:', error);
      next(error);
    }
  }

  // GET /api/settings/whatsapp
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const config = await prisma.whatsAppConfig.findUnique({
        where: { businessId },
      });

      return sendSuccess(res, {
        phoneNumberId: config?.phoneNumberId || '',
        businessAccountId: config?.businessAccountId || '',
        verifyToken: config?.verifyToken || env.WHATSAPP_VERIFY_TOKEN,
        isConnected: config?.isConnected || false,
        webhookUrl: `${env.BACKEND_URL || (req.protocol + '://' + req.get('host'))}/api/webhooks/whatsapp`,
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/settings/whatsapp
  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const { phoneNumberId, businessAccountId, verifyToken } = req.body;

      const updated = await prisma.whatsAppConfig.upsert({
        where: { businessId },
        update: {
          phoneNumberId,
          businessAccountId,
          verifyToken,
          isConnected: Boolean(phoneNumberId && businessAccountId),
        },
        create: {
          businessId,
          phoneNumberId,
          businessAccountId,
          verifyToken,
          isConnected: Boolean(phoneNumberId && businessAccountId),
        },
      });

      return sendSuccess(res, {
        phoneNumberId: updated.phoneNumberId,
        businessAccountId: updated.businessAccountId,
        isConnected: updated.isConnected,
      }, 'WhatsApp configuration updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const whatsAppController = new WhatsAppController();