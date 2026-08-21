import { IAIProvider, AIAnalysisInput } from '../interfaces/ai-provider.interface.js';
import { AIAnalysisResult, AIAnalysisResultSchema } from '../schemas/ai-extraction.schema.js';
import { SYSTEM_PROMPT_PAKISTAN_SME } from '../prompts/message-analysis.prompt.js';
import { logger } from '../../../common/utils/logger.js';

export class GeminiAIProvider implements IAIProvider {
  public name = 'gemini';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async analyzeMessage(input: AIAnalysisInput): Promise<AIAnalysisResult> {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
      const prompt = `
${SYSTEM_PROMPT_PAKISTAN_SME}

Analyze this customer WhatsApp message:
Message: "${input.messageText}"
Sender Phone: "${input.senderPhone || 'Unknown'}"
Sender Name: "${input.senderName || 'Unknown'}"

Return ONLY a JSON object adhering to this schema:
{
  "intent": "new_order | product_inquiry | quotation_request | complaint | appointment_request | follow_up_request | payment_related | delivery_related | general_question | unknown",
  "confidence": 0.0 to 1.0,
  "reasoning": "string explanation",
  "entities": {
    "customer_name": string or null,
    "product_name": string or null,
    "quantity": integer or null,
    "size": string or null,
    "color": string or null,
    "price": number or null,
    "address": string or null,
    "date": string or null,
    "time": string or null,
    "payment_method": string or null,
    "payment_amount": number or null,
    "order_reference": string or null,
    "requested_action": string or null,
    "notes": string or null
  },
  "requires_human_review": boolean,
  "suggested_task_title": string or null,
  "suggested_due_date": string or null
}
`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as any;
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResponse) {
        throw new Error('Empty response from Gemini API');
      }

      const parsedJson = JSON.parse(textResponse);
      const validated = AIAnalysisResultSchema.parse({
        ...parsedJson,
        provider_used: 'gemini-1.5-flash',
      });

      return validated;
    } catch (error: any) {
      logger.error('Gemini Provider failed, falling back to mock provider:', { message: error.message });
      throw error;
    }
  }
}