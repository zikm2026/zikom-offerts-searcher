import { IEmailLogger } from '../interfaces/IEmailLogger';
import { ExcelData } from '../../../types/email';
import { EmailLogger } from '../processors/EmailLogger';

export class EmailLoggerAdapter implements IEmailLogger {
  private emailLogger: EmailLogger;

  constructor() {
    this.emailLogger = new EmailLogger();
  }

  logAllLaptops(excelData: ExcelData, emailSubject: string): void {
    this.emailLogger.logAllLaptops(excelData, emailSubject);
  }
}

