import { Request, Response, NextFunction } from 'express';
import { whatsAppService } from './whatsapp.service.js';
import { sendSuccess } from '../../common/utils/response.js';
import { BadRequestError } from '../../common/errors/app-error.js';

export class SimulatorController {
  async simulateMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.businessId!;
      const { phoneNumber, customerName, message, timestamp } = req.body;

      if (!phoneNumber || !message) {
        throw new BadRequestError('Phone number and message text are required for simulation');
      }

      const result = await whatsAppService.processIncomingMessage(
        {
          externalMessageId: `sim-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          senderPhoneNumber: phoneNumber,
          senderName: customerName || 'Simulator Customer',
          timestamp: timestamp ? new Date(timestamp) : new Date(),
          type: 'TEXT',
          text: message,
          rawPayload: { simulated: true, originalBody: req.body },
        },
        businessId
      );

      return sendSuccess(res, result, 'Simulated WhatsApp message processed through pipeline');
    } catch (error) {
      next(error);
    }
  }
}

export const simulatorController = new SimulatorController();