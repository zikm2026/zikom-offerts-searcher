import { ILaptopMatcher } from '../interfaces/ILaptopMatcher';
import { ExcelData, EmailMatchResult } from '../../../types/email';
import LaptopMatcherService from '../../laptopMatcherService';

export class LaptopMatcherAdapter implements ILaptopMatcher {
  constructor(private laptopMatcherService: LaptopMatcherService) {}

  async matchEmailLaptops(excelData: ExcelData): Promise<EmailMatchResult> {
    return this.laptopMatcherService.matchEmailLaptops(excelData);
  }

  logMatchResults(subject: string, matchResult: EmailMatchResult): void {
    this.laptopMatcherService.logMatchResults(subject, matchResult);
  }
}

