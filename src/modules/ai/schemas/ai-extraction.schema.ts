import { z } from 'zod';

export const AIIntentEnum = z.enum([
  'new_order',
  'product_inquiry',
  'quotation_request',
  'complaint',
  'appointment_request',
  'follow_up_request',
  'payment_related',
  'delivery_related',
  'general_question',
  'unknown'
]);
export type AIIntent = z.infer<typeof AIIntentEnum>;

export const AIEntitiesSchema = z.object({
  customer_name: z.string().nullable().optional(),
  product_name: z.string().nullable().optional(),
  quantity: z.number().int().positive().nullable().optional(),
  size: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  price: z.number().positive().nullable().optional(),
  address: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  time: z.string().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  payment_amount: z.number().positive().nullable().optional(),
  order_reference: z.string().nullable().optional(),
  requested_action: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type AIEntities = z.infer<typeof AIEntitiesSchema>;

export const AIAnalysisResultSchema = z.object({
  intent: AIIntentEnum,
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
  entities: AIEntitiesSchema,
  requires_human_review: z.boolean(),
  suggested_task_title: z.string().nullable().optional(),
  suggested_due_date: z.string().nullable().optional(),
  provider_used: z.string().optional(),
});
export type AIAnalysisResult = z.infer<typeof AIAnalysisResultSchema>;