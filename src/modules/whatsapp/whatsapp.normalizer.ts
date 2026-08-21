export interface NormalizedIncomingMessage {
  externalMessageId: string;
  senderPhoneNumber: string;
  senderName?: string;
  timestamp: Date;
  type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'DOCUMENT';
  text?: string;
  rawPayload: Record<string, unknown>;
  phoneNumberId?: string;
}

export function normalizePhoneNumber(phone: string): string {
  // Strip spaces, dashes, parentheses, plus
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  if (cleaned.startsWith('0092')) {
    cleaned = cleaned.substring(4);
  } else if (cleaned.startsWith('92')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  return `+92${cleaned}`;
}

export function normalizeMetaWebhookPayload(body: any): NormalizedIncomingMessage[] {
  const normalized: NormalizedIncomingMessage[] = [];

  if (!body || body.object !== 'whatsapp_business_account' || !body.entry) {
    return normalized;
  }

  for (const entry of body.entry) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages' || !change.value || !change.value.messages) {
        continue;
      }

      const value = change.value;
      const phoneNumberId = value.metadata?.phone_number_id;
      const contacts = value.contacts || [];
      const contactMap = new Map<string, string>();
      for (const contact of contacts) {
        if (contact.wa_id && contact.profile?.name) {
          contactMap.set(contact.wa_id, contact.profile.name);
        }
      }

      for (const msg of value.messages) {
        const senderPhone = normalizePhoneNumber(msg.from);
        const senderName = contactMap.get(msg.from);

        let type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'DOCUMENT' = 'TEXT';
        let text: string | undefined = undefined;

        if (msg.type === 'text') {
          type = 'TEXT';
          text = msg.text?.body;
        } else if (msg.type === 'image') {
          type = 'IMAGE';
          text = msg.image?.caption || '[Image received]';
        } else if (msg.type === 'audio') {
          type = 'AUDIO';
          text = '[Voice note received]';
        } else if (msg.type === 'document') {
          type = 'DOCUMENT';
          text = msg.document?.caption || `[Document: ${msg.document?.filename || 'attachment'}]`;
        }

        normalized.push({
          externalMessageId: msg.id || `meta-msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          senderPhoneNumber: senderPhone,
          senderName,
          timestamp: msg.timestamp ? new Date(parseInt(msg.timestamp, 10) * 1000) : new Date(),
          type,
          text,
          rawPayload: body,
          phoneNumberId,
        });
      }
    }
  }

  return normalized;
}