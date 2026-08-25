import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env.js';
import { normalizeMetaWebhookPayload } from './whatsapp.normalizer.js';
import { whatsAppService } from './whatsapp.service.js';
import { prisma } from '../../config/database.js';
import { logger } from '../../common/utils/logger.js';
import { sendSuccess } from '../../common/utils/response.js';

export class WhatsAppController {
  // GET /api/webhooks/whatsapp - Meta Verification Handshake
  async verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode !== 'subscribe' || !token) {
      logger.warn('Meta Webhook verification missing required parameters');
      return res.status(400).json({ error: 'Missing hub.mode or hub.verify_token' });
    }

    const tokenStr = String(token).trim();

    // Check against env token OR any business in database that has this verifyToken
    const isEnvMatch = Boolean(env.WHATSAPP_VERIFY_TOKEN && tokenStr === env.WHATSAPP_VERIFY_TOKEN.trim());
    
    let isDbMatch = false;
    try {
      const config = await prisma.whatsAppConfig.findFirst({
        where: { verifyToken: tokenStr },
      });
      if (config) {
        isDbMatch = true;
      }
    } catch (e) {
      logger.error('Error checking verifyToken in database:', e);
    }

    if (isEnvMatch || isDbMatch) {
      logger.info('Meta WhatsApp Webhook successfully verified with token: ' + tokenStr);
      return res.status(200).send(challenge);
    }

    logger.warn('Meta Webhook verification failed. Received token: ' + tokenStr);
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

      const effectiveToken = config?.accessToken || env.WHATSAPP_ACCESS_TOKEN || '';

      return sendSuccess(res, {
        phoneNumberId: config?.phoneNumberId || '',
        businessAccountId: config?.businessAccountId || '',
        accessToken: effectiveToken,
        hasAccessToken: Boolean(effectiveToken),
        verifyToken: config?.verifyToken || env.WHATSAPP_VERIFY_TOKEN,
        isConnected: Boolean(config?.phoneNumberId && (config?.accessToken || env.WHATSAPP_ACCESS_TOKEN)),
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
      const { phoneNumberId, businessAccountId, accessToken, verifyToken } = req.body;

      const cleanPhoneId = phoneNumberId ? String(phoneNumberId).trim() : null;
      const cleanWabaId = businessAccountId ? String(businessAccountId).trim() : null;
      const cleanAccessToken = accessToken ? String(accessToken).trim() : undefined;
      const cleanVerifyToken = verifyToken ? String(verifyToken).trim() : env.WHATSAPP_VERIFY_TOKEN;
      const isConnected = Boolean(cleanPhoneId && (cleanAccessToken || env.WHATSAPP_ACCESS_TOKEN));

      logger.info(`Saving WhatsApp config - PhoneId: ${cleanPhoneId}, HasToken: ${Boolean(cleanAccessToken)}, WABA: ${cleanWabaId}`);

      const updated = await prisma.whatsAppConfig.upsert({
        where: { businessId },
        update: {
          phoneNumberId: cleanPhoneId,
          businessAccountId: cleanWabaId,
          ...(cleanAccessToken !== undefined ? { accessToken: cleanAccessToken } : {}),
          verifyToken: cleanVerifyToken,
          isConnected,
        },
        create: {
          businessId,
          phoneNumberId: cleanPhoneId,
          businessAccountId: cleanWabaId,
          accessToken: cleanAccessToken || null,
          verifyToken: cleanVerifyToken,
          isConnected,
        },
      });

      logger.info(`WhatsApp config saved. isConnected: ${updated.isConnected}`);

      return sendSuccess(res, {
        phoneNumberId: updated.phoneNumberId,
        businessAccountId: updated.businessAccountId,
        accessToken: updated.accessToken || '',
        verifyToken: updated.verifyToken,
        isConnected: updated.isConnected,
      }, 'WhatsApp configuration updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const whatsAppController = new WhatsAppController();