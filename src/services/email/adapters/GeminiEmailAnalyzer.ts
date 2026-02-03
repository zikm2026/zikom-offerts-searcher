import { IEmailAnalyzer } from '../interfaces/IEmailAnalyzer';
import { EmailMessage, OfferAnalysis } from '../../../types/email';
import { GeminiService } from '../../gemini';

export class GeminiEmailAnalyzer implements IEmailAnalyzer {
  constructor(private geminiService: GeminiService) {}

  async analyzeEmailOffer(email: EmailMessage): Promise<OfferAnalysis> {
    return this.geminiService.analyzeEmailOffer(email);
  }
}

