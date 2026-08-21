import { AIAnalysisResult } from '../schemas/ai-extraction.schema.js';

export interface AIAnalysisInput {
  messageText: string;
  senderPhone?: string;
  senderName?: string;
  previousMessages?: Array<{ sender: string; text: string }>;
}

export interface IAIProvider {
  name: string;
  analyzeMessage(input: AIAnalysisInput): Promise<AIAnalysisResult>;
}