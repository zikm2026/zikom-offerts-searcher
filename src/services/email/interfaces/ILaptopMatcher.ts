import { ExcelData, EmailMatchResult } from '../../../types/email';

export interface ILaptopMatcher {
  matchEmailLaptops(excelData: ExcelData): Promise<EmailMatchResult>;
  logMatchResults(subject: string, matchResult: EmailMatchResult): void;
}

