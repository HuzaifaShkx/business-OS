import { IAIProvider, AIAnalysisInput } from '../interfaces/ai-provider.interface.js';
import { AIAnalysisResult } from '../schemas/ai-extraction.schema.js';

export class MockAIProvider implements IAIProvider {
  public name = 'mock';

  async analyzeMessage(input: AIAnalysisInput): Promise<AIAnalysisResult> {
    const text = input.messageText.toLowerCase();

    // 1. Order Intent
    if (text.includes('bhej dena') || text.includes('bhej dein') || text.includes('bhej do') || text.includes('order') || text.includes('chahiye') || text.includes('send karein')) {
      // Check product name first
      let productName = 'Product Item';
      if (text.includes('perfume') || text.includes('oud') || text.includes('attar')) {
        productName = text.includes('black') ? 'Black Oud Perfume' : 'Luxury Perfume';
      } else if (text.includes('suit') || text.includes('piece') || text.includes('lawn') || text.includes('kurta')) {
        if (text.includes('black 3 piece') || text.includes('3 piece')) productName = 'Black 3 Piece Suit';
        else if (text.includes('luxury lawn')) productName = 'Luxury Lawn Collection Suit';
        else if (text.includes('white kurta')) productName = 'White Formal Kurta';
        else productName = 'Fabric Suit Collection';
      }

      // Check size
      let size: string | null = null;
      if (text.includes('medium') || text.includes(' med ')) size = 'Medium';
      else if (text.includes('large') || text.includes(' lrg ')) size = 'Large';
      else if (text.includes('small') || text.includes(' sml ')) size = 'Small';
      else if (text.includes('xl') || text.includes('extra large')) size = 'XL';

      // Check quantity: remove product descriptions like "3 piece" or "2 piece" before parsing count
      const textWithoutProductSpecs = text.replace(/(3\s*piece|2\s*piece|1\s*piece)/gi, '');
      const qtyDirect = textWithoutProductSpecs.match(/(?:size\s*(?:medium|large|small|xl)?\s*(\d+))|(\d+)\s*(?:bhej|send|chahiye|order)|(\d+)\s*(?:suit|bottle|box|jora|piece)/i);
      const qtyFallback = textWithoutProductSpecs.match(/\b([1-9]|10|20|50|100)\b/);
      const quantity = qtyDirect ? parseInt(qtyDirect[1] || qtyDirect[2] || qtyDirect[3], 10) : (qtyFallback ? parseInt(qtyFallback[1], 10) : null);

      // Check payment
      let paymentMethod: string | null = null;
      if (text.includes('cod') || text.includes('cash on delivery')) paymentMethod = 'COD';
      else if (text.includes('jazzcash') || text.includes('jazz cash')) paymentMethod = 'JazzCash';
      else if (text.includes('easypaisa') || text.includes('easy paisa')) paymentMethod = 'EasyPaisa';
      else if (text.includes('bank') || text.includes('transfer') || text.includes('meezan')) paymentMethod = 'Bank Transfer';

      // Check address
      let address: string | null = null;
      if (text.includes('bahria town')) address = 'Bahria Town Phase 7';
      else if (text.includes('gulberg')) address = 'Gulberg, Lahore';
      else if (text.includes('dha')) address = 'DHA Phase 5, Karachi';
      else if (text.includes('f-10') || text.includes('islamabad')) address = 'Sector F-10, Islamabad';
      else if (text.includes('multan')) address = 'Multan';
      else if (text.includes('peshawar')) address = 'Peshawar';

      // Check if vague (e.g. "bhai suit bhej dena jo kal dikhaya tha")
      const isVague = text.includes('jo kal') || (!quantity && !size && !address);
      const confidence = isVague ? 0.62 : (quantity && address ? 0.96 : 0.82);

      return {
        intent: 'new_order',
        confidence,
        reasoning: isVague ? 'Customer requested an order but specific size/address/quantity is ambiguous.' : 'Clear purchase request with explicit product/payment/quantity indicators.',
        entities: {
          product_name: productName,
          quantity,
          size,
          address,
          payment_method: paymentMethod || (address ? 'COD' : null),
        },
        requires_human_review: confidence < 0.75,
        suggested_task_title: isVague ? 'Confirm suit details with customer' : null,
        provider_used: 'mock-pakistan-nlp',
      };
    }

    // 2. Payment Intent
    if (text.includes('payment') || text.includes('transfer') || text.includes('jazzcash') || text.includes('easypaisa') || text.includes('screenshot') || text.includes('pesa')) {
      const amountMatch = text.match(/(\d{3,7})/);
      const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
      const isFuturePromise = text.includes('monday') || text.includes('kal') || text.includes('itwar') || text.includes('kardunga') || text.includes('send karunga');

      if (isFuturePromise) {
        return {
          intent: 'follow_up_request',
          confidence: 0.92,
          reasoning: 'Customer promised payment/follow-up on a specific upcoming date.',
          entities: {
            date: text.includes('monday') ? 'Monday' : (text.includes('kal') ? 'Tomorrow' : 'Upcoming Date'),
            payment_amount: amount,
            requested_action: 'follow_up_payment',
          },
          requires_human_review: false,
          suggested_task_title: `Follow up regarding promised payment (${amount ? 'Rs. ' + amount : 'Pending'})`,
          suggested_due_date: new Date(Date.now() + 86400000 * 2).toISOString(),
          provider_used: 'mock-pakistan-nlp',
        };
      }

      return {
        intent: 'payment_related',
        confidence: 0.95,
        reasoning: 'Customer sent payment confirmation / screenshot verification notice.',
        entities: {
          payment_amount: amount,
          payment_method: text.includes('meezan') ? 'Meezan Bank' : (text.includes('jazzcash') ? 'JazzCash' : 'Bank Transfer'),
          requested_action: 'verify_payment',
        },
        requires_human_review: false,
        suggested_task_title: `Verify payment of Rs. ${amount || 'amount'}`,
        suggested_due_date: new Date(Date.now() + 86400000).toISOString(),
        provider_used: 'mock-pakistan-nlp',
      };
    }

    // 3. Complaint Intent
    if (text.includes('complaint') || text.includes('leak') || text.includes('kharab') || text.includes('replace') || text.includes('defect') || text.includes('damage')) {
      return {
        intent: 'complaint',
        confidence: 0.93,
        reasoning: 'Customer reported a defect, leak, or requested replacement.',
        entities: {
          requested_action: 'replacement_or_refund',
          notes: 'Customer reported issue with order item',
        },
        requires_human_review: false,
        suggested_task_title: 'Handle customer complaint / replacement request',
        suggested_due_date: new Date(Date.now() + 86400000).toISOString(),
        provider_used: 'mock-pakistan-nlp',
      };
    }

    // 4. Delivery / Tracking Intent
    if (text.includes('tracking') || text.includes('parcel') || text.includes('dispatch') || text.includes('received nahi') || text.includes('kahan pohncha')) {
      return {
        intent: 'delivery_related',
        confidence: 0.91,
        reasoning: 'Customer requesting parcel delivery status or courier tracking number.',
        entities: {
          requested_action: 'provide_tracking_number',
        },
        requires_human_review: false,
        suggested_task_title: 'Check courier dispatch status & send tracking ID',
        suggested_due_date: new Date(Date.now() + 86400000).toISOString(),
        provider_used: 'mock-pakistan-nlp',
      };
    }

    // 5. Quotation / Discount
    if (text.includes('discount') || text.includes('wholesale') || text.includes('kitne ka milega') || text.includes('kitna discount')) {
      const qtyMatch = text.match(/\b([1-9]|10|20|50|100)\b/);
      return {
        intent: 'quotation_request',
        confidence: 0.94,
        reasoning: 'Customer inquiring about bulk pricing or wholesale discounts.',
        entities: {
          quantity: qtyMatch ? parseInt(qtyMatch[1], 10) : null,
          requested_action: 'send_quotation',
        },
        requires_human_review: false,
        suggested_task_title: 'Prepare and send wholesale quotation',
        suggested_due_date: new Date(Date.now() + 86400000).toISOString(),
        provider_used: 'mock-pakistan-nlp',
      };
    }

    // 6. Product Inquiry
    if (text.includes('price') || text.includes('available') || text.includes('stock') || text.includes('rate') || text.includes('color') || text.includes('size')) {
      return {
        intent: 'product_inquiry',
        confidence: 0.95,
        reasoning: 'Customer asking for catalog details, availability, or pricing.',
        entities: {
          requested_action: 'provide_catalog_details',
        },
        requires_human_review: false,
        provider_used: 'mock-pakistan-nlp',
      };
    }

    // Default Fallback
    return {
      intent: 'general_question',
      confidence: 0.70,
      reasoning: 'General greeting or unclassified customer query.',
      entities: {},
      requires_human_review: true,
      provider_used: 'mock-pakistan-nlp',
    };
  }
}