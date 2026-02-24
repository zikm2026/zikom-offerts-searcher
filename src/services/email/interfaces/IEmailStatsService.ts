export interface EmailStatInput {
  status: 'processed' | 'accepted' | 'rejected';
  reason?: string;
  subject?: string;
  from?: string;
  productType?: 'laptop' | 'monitor' | 'desktop';
}

export interface IEmailStatsService {
  recordEmailStat(input: EmailStatInput): Promise<void>;
}

