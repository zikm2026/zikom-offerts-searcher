import { EmailMessage, OfferAnalysis } from '../../../types/email';

export interface IEmailAnalyzer {
  analyzeEmailOffer(email: EmailMessage): Promise<OfferAnalysis>;
}

