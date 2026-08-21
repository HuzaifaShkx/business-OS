import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding WhatsApp Business OS Database with realistic Pakistani SME data...');

  // Clean existing
  await prisma.reviewItem.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.task.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.whatsAppConfig.deleteMany();
  await prisma.userBusiness.deleteMany();
  await prisma.business.deleteMany();
  await prisma.user.deleteMany();

  // 1. Create Default Owner User
  const passwordHash = await bcrypt.hash('Admin123!', 10);
  const user = await prisma.user.create({
    data: {
      email: 'owner@alrehman.pk',
      passwordHash,
      name: 'Tariq Mehmood',
    },
  });

  // 2. Create Business Workspace
  const business = await prisma.business.create({
    data: {
      name: 'Al-Rehman Fabrics & Fragrances',
      ownerId: user.id,
      phone: '+923009988776',
    },
  });

  // Link User to Business
  await prisma.userBusiness.create({
    data: {
      userId: user.id,
      businessId: business.id,
      role: 'OWNER',
    },
  });

  // WhatsApp Config
  await prisma.whatsAppConfig.create({
    data: {
      businessId: business.id,
      phoneNumberId: '109823485729384',
      businessAccountId: '298374928374928',
      verifyToken: 'pakistan_whatsapp_biz_os_verify_token_2026',
      isConnected: true,
    },
  });

  // 3. Create 10 Pakistani Customers
  const customerData = [
    { name: 'Ahmed Bilal', phone: '+923001234567', email: 'ahmed.b@gmail.com', address: 'House 42, Street 8, Bahria Town Phase 7, Rawalpindi', notes: 'VIP customer, prefers COD' },
    { name: 'Fatima Noor', phone: '+923219876543', email: 'fatima.noor@yahoo.com', address: 'Flat 4B, Gulberg Heights, Gulberg III, Lahore', notes: 'Frequent buyer of luxury lawn' },
    { name: 'Muhammad Hamza', phone: '+923335551234', email: 'hamza.m@outlook.com', address: 'Street 19, Sector F-10/2, Islamabad', notes: 'Asked for wholesale catalog' },
    { name: 'Zainab Tariq', phone: '+923456789012', email: 'zainab.t@gmail.com', address: 'Bungalow 12-C, 24th Commercial, DHA Phase 5, Karachi', notes: 'Prefers Bank Transfer' },
    { name: 'Bilal Hassan', phone: '+923123456789', email: 'bilal.h@gmail.com', address: 'Shop 14, Main Saddar Bazaar, Peshawar', notes: 'Solar accessories & perfumes' },
    { name: 'Ayesha Khan', phone: '+923019876543', email: 'ayesha.k@gmail.com', address: 'House 88, Block C, Model Town, Lahore', notes: 'Prefers evening delivery' },
    { name: 'Usman Ali', phone: '+923224445566', email: 'usman.ali@gmail.com', address: 'Near Shell Pump, Satellite Town, Gujranwala', notes: 'Repeated orders' },
    { name: 'Sana Mir', phone: '+923348889900', email: 'sana.mir@yahoo.com', address: 'Apartment 901, Pearl Residency, University Road, Karachi', notes: 'Inquired about Eid collection' },
    { name: 'Farhan Saeed', phone: '+923157776655', email: 'farhan.s@gmail.com', address: 'House 15, Kashmir Road, Cantt, Sialkot', notes: 'Fast response required' },
    { name: 'Hina Zafar', phone: '+923061112233', email: 'hina.z@gmail.com', address: 'Plot 34, Sector A, Wapda Town, Multan', notes: 'Prefers JazzCash' },
  ];

  const createdCustomers = [];
  for (const c of customerData) {
    const cust = await prisma.customer.create({
      data: {
        businessId: business.id,
        name: c.name,
        phoneNumber: c.phone,
        email: c.email,
        address: c.address,
        notes: c.notes,
      },
    });
    createdCustomers.push(cust);
  }

  // 4. Create Conversations & 20 Messages
  const conversationSamples = [
    {
      custIdx: 0,
      text: 'Assalam o Alaikum bhai black 3 piece medium size 2 bhej dena Bahria Town Phase 7 COD',
      intent: 'new_order',
      confidence: 0.96,
      entities: { product_name: 'black 3 piece', quantity: 2, size: 'medium', address: 'Bahria Town Phase 7', payment_method: 'COD' },
      order: { num: 'ORD-1001', amount: 9500, status: 'CONFIRMED', pmethod: 'COD', items: [{ name: 'Black 3 Piece Suit (Medium)', qty: 2, price: 4750 }] }
    },
    {
      custIdx: 1,
      text: 'AOA, luxury lawn 2 suits aur 1 Amber Oud perfume add kardein mere order me please',
      intent: 'new_order',
      confidence: 0.94,
      entities: { product_name: 'luxury lawn suits & Amber Oud perfume', quantity: 3, payment_method: 'COD' },
      order: { num: 'ORD-1002', amount: 14200, status: 'PROCESSING', pmethod: 'COD', items: [{ name: 'Luxury Lawn Suit', qty: 2, price: 5500 }, { name: 'Amber Oud Perfume 50ml', qty: 1, price: 3200 }] }
    },
    {
      custIdx: 2,
      text: 'Bhai jaan maine 12000 Rs Meezan Bank transfer kardiye hain, payment check kar lein',
      intent: 'payment_related',
      confidence: 0.95,
      entities: { payment_amount: 12000, payment_method: 'Bank Transfer (Meezan Bank)', requested_action: 'verify_payment' },
      task: { title: 'Verify Meezan Bank Transfer (Rs. 12,000)', priority: 'HIGH', dueInDays: 1 }
    },
    {
      custIdx: 3,
      text: 'InshaAllah payment Monday ko send kardungi 3 baje tak',
      intent: 'follow_up_request',
      confidence: 0.91,
      entities: { date: 'Monday', time: '3:00 PM', requested_action: 'follow_up_payment' },
      task: { title: 'Follow up on promised payment with Zainab Tariq', priority: 'MEDIUM', dueInDays: 3 }
    },
    {
      custIdx: 4,
      text: 'Bhai 5 pieces Black Velvet suit chahiye, bulk discount kitna milega?',
      intent: 'quotation_request',
      confidence: 0.93,
      entities: { product_name: 'Black Velvet suit', quantity: 5, requested_action: 'quotation' },
      task: { title: 'Send bulk wholesale discount quote to Bilal Hassan', priority: 'HIGH', dueInDays: 1 }
    },
    {
      custIdx: 5,
      text: 'Bhai mera parcel tracking number de dein, 4 din ho gaye hain dispatch hue',
      intent: 'delivery_related',
      confidence: 0.89,
      entities: { requested_action: 'tracking_number' },
      task: { title: 'Check courier dispatch status & send tracking to Ayesha Khan', priority: 'MEDIUM', dueInDays: 1 }
    },
    {
      custIdx: 6,
      text: 'Bhai suit bhej dena jo kal dikhaya tha',
      intent: 'new_order',
      confidence: 0.62, // Low confidence -> Triggers AI Review Queue
      entities: { product_name: 'suit from yesterday', quantity: 1 },
      review: { type: 'LOW_CONFIDENCE_INTENT', status: 'PENDING', conf: 0.62 }
    },
    {
      custIdx: 7,
      text: 'White Kurta Large size 1 piece DHA Karachi bhej dein JazzCash kardiya hai',
      intent: 'new_order',
      confidence: 0.95,
      entities: { product_name: 'White Kurta', size: 'Large', quantity: 1, address: 'DHA Karachi', payment_method: 'JazzCash' },
      order: { num: 'ORD-1003', amount: 3800, status: 'COMPLETED', pmethod: 'JazzCash', items: [{ name: 'White Kurta (Large)', qty: 1, price: 3800 }] }
    },
    {
      custIdx: 8,
      text: 'Complaint: Perfume bottle leak thi jab box open kiya, please replace karein',
      intent: 'complaint',
      confidence: 0.92,
      entities: { product_name: 'Perfume bottle', requested_action: 'replacement' },
      task: { title: 'Handle leaky perfume replacement for Farhan Saeed', priority: 'HIGH', dueInDays: 1 }
    },
    {
      custIdx: 9,
      text: 'AOA bhai, kya Blue Sapphire perfume stock me available hai?',
      intent: 'product_inquiry',
      confidence: 0.97,
      entities: { product_name: 'Blue Sapphire perfume', requested_action: 'stock_check' }
    }
  ];

  for (let i = 0; i < conversationSamples.length; i++) {
    const s = conversationSamples[i];
    const customer = createdCustomers[s.custIdx];

    const conv = await prisma.conversation.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        channel: 'whatsapp',
        externalConversationId: `ext-conv-${customer.phoneNumber}`,
        status: 'ACTIVE',
        lastMessageAt: new Date(Date.now() - (i * 3600000)),
      },
    });

    const msg = await prisma.message.create({
      data: {
        conversationId: conv.id,
        direction: 'INBOUND',
        sender: customer.phoneNumber,
        messageType: 'TEXT',
        text: s.text,
        externalMessageId: `msg-meta-${i + 1000}`,
        timestamp: new Date(Date.now() - (i * 3600000)),
        aiProcessed: true,
        aiConfidence: s.confidence,
        aiIntent: s.intent,
        aiEntities: JSON.stringify(s.entities),
        rawPayload: JSON.stringify({ entry: [{ id: 'waba', changes: [{ value: { messages: [{ from: customer.phoneNumber, text: { body: s.text } }] } }] }] }),
      },
    });

    // Create Order if applicable
    if (s.order) {
      const order = await prisma.order.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          conversationId: conv.id,
          orderNumber: s.order.num,
          status: s.order.status,
          totalAmount: s.order.amount,
          paymentMethod: s.order.pmethod,
          deliveryAddress: customer.address,
          notes: 'Auto-created from WhatsApp AI Extraction',
        },
      });

      for (const item of s.order.items) {
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productName: item.name,
            quantity: item.qty,
            unitPrice: item.price,
          },
        });
      }
    }

    // Create Task if applicable
    if (s.task) {
      const due = new Date();
      due.setDate(due.getDate() + (s.task.dueInDays || 1));
      await prisma.task.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          conversationId: conv.id,
          title: s.task.title,
          description: s.text,
          dueAt: due,
          status: 'PENDING',
          priority: s.task.priority,
          source: 'ai_extracted',
        },
      });
    }

    // Create Review Item if low confidence
    if (s.review) {
      await prisma.reviewItem.create({
        data: {
          businessId: business.id,
          conversationId: conv.id,
          messageId: msg.id,
          customerId: customer.id,
          reviewType: s.review.type,
          suggestedData: JSON.stringify({
            detectedIntent: s.intent,
            confidence: s.confidence,
            suggestedOrder: { productName: 'Suit (Color & Size unspecified)', quantity: 1 },
            notes: 'Customer did not specify which suit or size.',
          }),
          status: 'PENDING',
          confidence: s.review.conf,
        },
      });
    }
  }

  // Additional 5 sample orders to make it 15 total orders
  const additionalOrders = [
    { custIdx: 0, num: 'ORD-1004', amount: 5200, status: 'COMPLETED', pmethod: 'COD', name: 'Oud Royal Fragrance 100ml', qty: 1, price: 5200 },
    { custIdx: 1, num: 'ORD-1005', amount: 8800, status: 'COMPLETED', pmethod: 'Bank Transfer', name: 'Chiffon Embroidered Dupatta Suit', qty: 1, price: 8800 },
    { custIdx: 2, num: 'ORD-1006', amount: 6400, status: 'NEW', pmethod: 'COD', name: 'Charcoal Linen 2 Piece (Large)', qty: 2, price: 3200 },
    { custIdx: 3, num: 'ORD-1007', amount: 3500, status: 'CANCELLED', pmethod: 'COD', name: 'Rose Petal Attar 12ml', qty: 1, price: 3500 },
    { custIdx: 4, num: 'ORD-1008', amount: 16500, status: 'AWAITING_CONFIRMATION', pmethod: 'Bank Transfer', name: 'Raw Silk Formal Kurta Bundle', qty: 3, price: 5500 },
  ];

  for (const ao of additionalOrders) {
    const cust = createdCustomers[ao.custIdx];
    const ord = await prisma.order.create({
      data: {
        businessId: business.id,
        customerId: cust.id,
        orderNumber: ao.num,
        status: ao.status,
        totalAmount: ao.amount,
        paymentMethod: ao.pmethod,
        deliveryAddress: cust.address,
        notes: 'WhatsApp verified order',
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: ord.id,
        productName: ao.name,
        quantity: ao.qty,
        unitPrice: ao.price,
      },
    });
  }

  // Additional tasks to make 10 total tasks
  const additionalTasks = [
    { custIdx: 5, title: 'Call Ayesha Khan regarding Eid festive pre-booking', priority: 'LOW', dueInDays: 4 },
    { custIdx: 7, title: 'Send JazzCash payment receipt to Sana Mir', priority: 'MEDIUM', dueInDays: 2 },
    { custIdx: 8, title: 'Confirm return pickup tracking for Sialkot customer', priority: 'HIGH', dueInDays: 1 },
    { custIdx: 9, title: 'Send fragrance catalogue PDF to Hina Zafar', priority: 'LOW', dueInDays: 5 },
  ];

  for (const at of additionalTasks) {
    const cust = createdCustomers[at.custIdx];
    const due = new Date();
    due.setDate(due.getDate() + at.dueInDays);
    await prisma.task.create({
      data: {
        businessId: business.id,
        customerId: cust.id,
        title: at.title,
        status: 'PENDING',
        priority: at.priority,
        source: 'manual_followup',
        dueAt: due,
      },
    });
  }

  console.log('Seeding completed successfully!');
  console.log('Default credentials: owner@alrehman.pk / Admin123!');
}

main()
  .catch((e) => {
    console.error('Error seeding DB:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
