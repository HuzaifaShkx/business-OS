import { env } from '../../config/env.js';
import { IAIProvider, AIAnalysisInput } from './interfaces/ai-provider.interface.js';
import { AIAnalysisResult } from './schemas/ai-extraction.schema.js';
import { MockAIProvider } from './providers/mock.provider.js';
import { GeminiAIProvider } from './providers/gemini.provider.js';
import { logger } from '../../common/utils/logger.js';

export class AIService {
  private provider: IAIProvider;
  private fallbackProvider: IAIProvider;

  constructor() {
    this.fallbackProvider = new MockAIProvider();
    if (env.AI_PROVIDER === 'gemini' && env.GEMINI_API_KEY) {
      this.provider = new GeminiAIProvider(env.GEMINI_API_KEY);
      logger.info('AIService initialized with Gemini Provider');
    } else {
      this.provider = this.fallbackProvider;
      logger.info('AIService initialized with Mock Provider');
    }
  }

  public async analyzeMessage(input: AIAnalysisInput): Promise<AIAnalysisResult> {
    try {
      const result = await this.provider.analyzeMessage(input);
      // Enforce confidence threshold
      if (result.confidence < env.AI_CONFIDENCE_THRESHOLD) {
        result.requires_human_review = true;
      }
      return result;
    } catch (error: any) {
      logger.warn(`Primary AI provider failed. Using mock fallback: ${error.message}`);
      const fallbackResult = await this.fallbackProvider.analyzeMessage(input);
      if (fallbackResult.confidence < env.AI_CONFIDENCE_THRESHOLD) {
        fallbackResult.requires_human_review = true;
      }
      return fallbackResult;
    }
  }
}

export const aiService = new AIService();