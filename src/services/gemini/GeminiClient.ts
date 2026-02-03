import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import logger from '../../utils/logger';
import { GeminiConfig } from './types';
import { isRetryableError, getRetryDelayMs } from './retry';

export class GeminiClient {
  private model: GenerativeModel;

  constructor(config: GeminiConfig) {
    const genAI = new GoogleGenerativeAI(config.apiKey);
    this.model = genAI.getGenerativeModel({
      model: config.model,
      generationConfig: {
        maxOutputTokens: 8192,
      },
    });
  }

  async generateContent(prompt: string, retries: number = 3): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: unknown) {
      if (isRetryableError(error) && retries > 0) {
        const delay = getRetryDelayMs(retries);
        logger.warn(
          `Gemini API error: ${(error as Error)?.message ?? 'Service unavailable'}. Retrying in ${delay}ms... (${retries} attempts left)`
        );
        await this.sleep(delay);
        return this.generateContent(prompt, retries - 1);
      }
      throw error;
    }
  }

  getModel(): GenerativeModel {
    return this.model;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
