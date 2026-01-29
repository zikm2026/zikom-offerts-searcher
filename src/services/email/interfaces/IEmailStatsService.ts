export interface EmailStatInput {
  status: 'processed' | 'accepted' | 'rejected';
  reason?: string;
  subject?: string;
  from?: string;
}

export interface IEmailStatsService {
  recordEmailStat(input: EmailStatInput): Promise<void>;
}

