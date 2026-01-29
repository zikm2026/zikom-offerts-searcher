import { IEmailStatsService, EmailStatInput } from '../interfaces/IEmailStatsService';
import EmailStatsService from '../../emailStatsService';

export class EmailStatsServiceAdapter implements IEmailStatsService {
  constructor(private emailStatsService: EmailStatsService) {}

  async recordEmailStat(input: EmailStatInput): Promise<void> {
    return this.emailStatsService.recordEmailStat(input);
  }
}

