import { prisma } from '../../config/database.js';
import { aiService } from '../ai/ai.service.js';
import { NormalizedIncomingMessage, normalizePhoneNumber } from './whatsapp.normalizer.js';
import { logger } from '../../common/utils/logger.js';
import { AIAnalysisResult } from '../ai/schemas/ai-extraction.schema.js';

export interface ProcessMessageResult {
  customerId: string;
  conversationId: string;
  messageId: string;
  aiResult: AIAnalysisResult;
  createdOrderId?: string;
  createdTaskId?: string;
  createdReviewId?: string;
}

export class WhatsAppService {
  /**
   * Central message processing pipeline used by both Meta Webhooks and Dev Simulator.
   */
  async processIncomingMessage(msg: NormalizedIncomingMessage, businessId: string): Promise<ProcessMessageResult> {
    const normalizedPhone = normalizePhoneNumber(msg.senderPhoneNumber);

    // 1. Customer Resolution / Deduplication
    let customer = await prisma.customer.findUnique({
      where: {
        businessId_phoneNumber: {
          businessId,
          phoneNumber: normalizedPhone,
        },
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          businessId,
          phoneNumber: normalizedPhone,
          name: msg.senderName || 'WhatsApp Customer',
          firstContactAt: msg.timestamp,
          lastContactAt: msg.timestamp,
        },
      });
      logger.info(`New customer created: ${customer.id} (${normalizedPhone})`);
    } else {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          lastContactAt: msg.timestamp,
          name: (!customer.name || customer.name === 'WhatsApp Customer') && msg.senderName ? msg.senderName : customer.name,
        },
      });
    }

    // 2. Conversation Resolution
    let conversation = await prisma.conversation.findFirst({
      where: {
        businessId,
        customerId: customer.id,
        status: 'ACTIVE',
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          businessId,
          customerId: customer.id,
          channel: 'whatsapp',
          externalConversationId: `ext-${normalizedPhone}`,
          status: 'ACTIVE',
          lastMessageAt: msg.timestamp,
        },
      });
    } else {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: msg.timestamp },
      });
    }

    // 3. Store Raw Message Immediately (Never lose message data)
    const storedMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        sender: normalizedPhone,
        messageType: msg.type,
        text: msg.text || '',
        externalMessageId: msg.externalMessageId,
        timestamp: msg.timestamp,
        aiProcessed: false,
        rawPayload: JSON.stringify(msg.rawPayload),
      },
    });

    // 4. Run AI Intelligence Engine
    const aiResult = await aiService.analyzeMessage({
      messageText: msg.text || '',
      senderPhone: normalizedPhone,
      senderName: customer.name || undefined,
    });

    // 5. Update Message with AI Insights
    await prisma.message.update({
      where: { id: storedMessage.id },
      data: {
        aiProcessed: true,
        aiConfidence: aiResult.confidence,
        aiIntent: aiResult.intent,
        aiEntities: JSON.stringify(aiResult.entities),
      },
    });

    // Update customer address / notes if detected and not set
    if (aiResult.entities?.address && !customer.address) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { address: aiResult.entities.address },
      });
    }

    let createdOrderId: string | undefined;
    let createdTaskId: string | undefined;
    let createdReviewId: string | undefined;

    // 6. Business Logic Engine
    if (aiResult.requires_human_review) {
      // Create Review Item
      const reviewItem = await prisma.reviewItem.create({
        data: {
          businessId,
          conversationId: conversation.id,
          messageId: storedMessage.id,
          customerId: customer.id,
          reviewType: aiResult.intent === 'new_order' ? 'ORDER_CREATION' : 'LOW_CONFIDENCE_INTENT',
          suggestedData: JSON.stringify({
            detectedIntent: aiResult.intent,
            confidence: aiResult.confidence,
            entities: aiResult.entities,
            reasoning: aiResult.reasoning,
            messageText: msg.text,
          }),
          status: 'PENDING',
          confidence: aiResult.confidence,
        },
      });
      createdReviewId = reviewItem.id;
      logger.info(`Review item created: ${reviewItem.id} for message: ${storedMessage.id}`);
    } else {
      // Autonomous Execution
      if (aiResult.intent === 'new_order') {
        // Generate Order Number
        const count = await prisma.order.count({ where: { businessId } });
        const orderNumber = `ORD-${1000 + count + 1}`;

        const newOrder = await prisma.order.create({
          data: {
            businessId,
            customerId: customer.id,
            conversationId: conversation.id,
            orderNumber,
            status: 'AWAITING_CONFIRMATION',
            totalAmount: aiResult.entities?.price || (aiResult.entities?.quantity ? aiResult.entities.quantity * 2500 : null),
            paymentMethod: aiResult.entities?.payment_method || 'COD',
            deliveryAddress: aiResult.entities?.address || customer.address,
            notes: `Auto-created from message: "${msg.text}"`,
          },
        });

        await prisma.orderItem.create({
          data: {
            orderId: newOrder.id,
            productName: aiResult.entities?.product_name || 'Standard Item',
            quantity: aiResult.entities?.quantity || 1,
            unitPrice: aiResult.entities?.price || 2500,
            notes: aiResult.entities?.size ? `Size: ${aiResult.entities.size}` : undefined,
          },
        });

        createdOrderId = newOrder.id;
        logger.info(`Auto-created order: ${orderNumber} for customer ${customer.name}`);
      } else if (aiResult.intent === 'follow_up_request' || aiResult.intent === 'payment_related' || aiResult.intent === 'complaint') {
        const dueAt = aiResult.suggested_due_date ? new Date(aiResult.suggested_due_date) : new Date(Date.now() + 86400000);
        const newTask = await prisma.task.create({
          data: {
            businessId,
            customerId: customer.id,
            conversationId: conversation.id,
            title: aiResult.suggested_task_title || `Follow up with ${customer.name}`,
            description: msg.text,
            dueAt,
            status: 'PENDING',
            priority: aiResult.intent === 'complaint' || aiResult.intent === 'payment_related' ? 'HIGH' : 'MEDIUM',
            source: 'ai_extracted',
          },
        });
        createdTaskId = newTask.id;
        logger.info(`Auto-created task: ${newTask.title}`);
      }
    }

    return {
      customerId: customer.id,
      conversationId: conversation.id,
      messageId: storedMessage.id,
      aiResult,
      createdOrderId,
      createdTaskId,
      createdReviewId,
    };
  }
}

export const whatsAppService = new WhatsAppService();