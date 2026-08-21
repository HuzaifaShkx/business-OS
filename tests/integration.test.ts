import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/database.js';
import { normalizePhoneNumber } from '../src/modules/whatsapp/whatsapp.normalizer.js';
import { aiService } from '../src/modules/ai/ai.service.js';
import { whatsAppService } from '../src/modules/whatsapp/whatsapp.service.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

describe('WhatsApp Business OS - Automated Test Suite', () => {
  let testBusinessId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Setup clean test business
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@testbiz.pk`,
        passwordHash: await bcrypt.hash('TestPass123!', 10),
        name: 'Test Owner',
      },
    });
    testUserId = user.id;

    const business = await prisma.business.create({
      data: {
        name: 'Test Fabrics & Scents',
        ownerId: user.id,
        phone: '+923001112233',
      },
    });
    testBusinessId = business.id;

    await prisma.userBusiness.create({
      data: {
        userId: user.id,
        businessId: business.id,
        role: 'OWNER',
      },
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.reviewItem.deleteMany({ where: { businessId: testBusinessId } });
    await prisma.orderItem.deleteMany({ where: { order: { businessId: testBusinessId } } });
    await prisma.order.deleteMany({ where: { businessId: testBusinessId } });
    await prisma.task.deleteMany({ where: { businessId: testBusinessId } });
    await prisma.message.deleteMany({ where: { conversation: { businessId: testBusinessId } } });
    await prisma.conversation.deleteMany({ where: { businessId: testBusinessId } });
    await prisma.customer.deleteMany({ where: { businessId: testBusinessId } });
    await prisma.userBusiness.deleteMany({ where: { businessId: testBusinessId } });
    await prisma.business.deleteMany({ where: { id: testBusinessId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  describe('1. Phone Normalization & Customer Deduplication', () => {
    it('normalizes various Pakistani phone number formats to standard +923XXXXXXXXX', () => {
      expect(normalizePhoneNumber('03001234567')).toBe('+923001234567');
      expect(normalizePhoneNumber('923001234567')).toBe('+923001234567');
      expect(normalizePhoneNumber('00923001234567')).toBe('+923001234567');
      expect(normalizePhoneNumber('+92 300-1234567')).toBe('+923001234567');
    });

    it('deduplicates customers sending multiple messages with alternate phone number formats', async () => {
      const msg1 = {
        externalMessageId: `msg-dedup-1-${Date.now()}`,
        senderPhoneNumber: '03009998877',
        senderName: 'Hamza Khan',
        timestamp: new Date(),
        type: 'TEXT' as const,
        text: 'AOA price bata dein',
        rawPayload: {},
      };

      const res1 = await whatsAppService.processIncomingMessage(msg1, testBusinessId);

      const msg2 = {
        externalMessageId: `msg-dedup-2-${Date.now()}`,
        senderPhoneNumber: '+92 300-9998877',
        senderName: 'Hamza Khan',
        timestamp: new Date(),
        type: 'TEXT' as const,
        text: 'Maine order finalize karna hai',
        rawPayload: {},
      };

      const res2 = await whatsAppService.processIncomingMessage(msg2, testBusinessId);

      expect(res1.customerId).toBe(res2.customerId);
      expect(res1.conversationId).toBe(res2.conversationId);
    });
  });

  describe('2. AI Extraction & Intent Classification for Roman Urdu', () => {
    it('extracts new_order intent with entities from Roman Urdu text', async () => {
      const result = await aiService.analyzeMessage({
        messageText: 'Assalam o Alaikum bhai black 3 piece medium size 2 bhej dena Bahria Town Phase 7 COD',
      });

      expect(result.intent).toBe('new_order');
      expect(result.confidence).toBeGreaterThanOrEqual(0.75);
      expect(result.entities.quantity).toBe(2);
      expect(result.entities.size).toBe('Medium');
      expect(result.entities.address).toContain('Bahria Town');
      expect(result.entities.payment_method).toBe('COD');
      expect(result.requires_human_review).toBe(false);
    });

    it('detects payment promises and marks follow_up_request', async () => {
      const result = await aiService.analyzeMessage({
        messageText: 'InshaAllah payment Monday ko send kardunga 3500 rs',
      });

      expect(result.intent).toBe('follow_up_request');
      expect(result.confidence).toBeGreaterThanOrEqual(0.75);
      expect(result.suggested_task_title).toContain('promised payment');
    });

    it('flags ambiguous/vague orders for human review (< 0.75 confidence)', async () => {
      const result = await aiService.analyzeMessage({
        messageText: 'Bhai suit bhej dena jo kal dikhaya tha',
      });

      expect(result.confidence).toBeLessThan(0.75);
      expect(result.requires_human_review).toBe(true);
    });
  });

  describe('3. Autonomous Order & Task Creation Pipeline', () => {
    it('automatically creates an order when high-confidence new_order message arrives', async () => {
      const msg = {
        externalMessageId: `msg-order-${Date.now()}`,
        senderPhoneNumber: '03217654321',
        senderName: 'Rashid Minhas',
        timestamp: new Date(),
        type: 'TEXT' as const,
        text: 'bhai 2 black suits bhej dena Gulberg Lahore COD',
        rawPayload: {},
      };

      const result = await whatsAppService.processIncomingMessage(msg, testBusinessId);

      expect(result.createdOrderId).toBeDefined();
      const order = await prisma.order.findUnique({
        where: { id: result.createdOrderId },
        include: { items: true },
      });

      expect(order).toBeDefined();
      expect(order?.paymentMethod).toBe('COD');
      expect(order?.items.length).toBeGreaterThan(0);
    });

    it('automatically creates a task when follow-up message arrives', async () => {
      const msg = {
        externalMessageId: `msg-task-${Date.now()}`,
        senderPhoneNumber: '03331122334',
        senderName: 'Saima Noor',
        timestamp: new Date(),
        type: 'TEXT' as const,
        text: 'Maine 5000 rs Meezan Bank transfer kardiye hain receipt check kar lein',
        rawPayload: {},
      };

      const result = await whatsAppService.processIncomingMessage(msg, testBusinessId);

      expect(result.createdTaskId).toBeDefined();
      const task = await prisma.task.findUnique({
        where: { id: result.createdTaskId },
      });
      expect(task).toBeDefined();
      expect(task?.priority).toBe('HIGH');
    });

    it('creates a review item when confidence is below threshold', async () => {
      const msg = {
        externalMessageId: `msg-review-${Date.now()}`,
        senderPhoneNumber: '03459988776',
        senderName: 'Noman Ali',
        timestamp: new Date(),
        type: 'TEXT' as const,
        text: 'bhai suit bhej do jo kal baat hui thi',
        rawPayload: {},
      };

      const result = await whatsAppService.processIncomingMessage(msg, testBusinessId);

      expect(result.createdReviewId).toBeDefined();
      const review = await prisma.reviewItem.findUnique({
        where: { id: result.createdReviewId },
      });
      expect(review).toBeDefined();
      expect(review?.status).toBe('PENDING');
    });
  });

  describe('4. Human-in-the-Loop Review Approval Workflow', () => {
    it('allows approving a pending review item and creating an order', async () => {
      const msg = {
        externalMessageId: `msg-rev-approve-${Date.now()}`,
        senderPhoneNumber: '03028889900',
        senderName: 'Kamran Akmal',
        timestamp: new Date(),
        type: 'TEXT' as const,
        text: 'bhai perfume bhej do jo kal baat hui thi',
        rawPayload: {},
      };

      const result = await whatsAppService.processIncomingMessage(msg, testBusinessId);
      expect(result.createdReviewId).toBeDefined();

      const review = await prisma.reviewItem.findUnique({
        where: { id: result.createdReviewId },
        include: { message: true, customer: true },
      });

      // Simulate approving the review
      const order = await prisma.order.create({
        data: {
          businessId: testBusinessId,
          customerId: review!.customerId!,
          conversationId: review!.conversationId,
          orderNumber: `ORD-${Date.now().toString().slice(-4)}`,
          status: 'CONFIRMED',
          totalAmount: 3200,
          paymentMethod: 'COD',
          deliveryAddress: 'Gulberg Lahore',
        },
      });

      const updatedReview = await prisma.reviewItem.update({
        where: { id: review!.id },
        data: { status: 'APPROVED', resolvedAt: new Date() },
      });

      expect(updatedReview.status).toBe('APPROVED');
      expect(order.id).toBeDefined();
    });
  });
});