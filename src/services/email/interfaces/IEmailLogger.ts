import { ExcelData } from '../../../types/email';

export interface IEmailLogger {
  logAllLaptops(excelData: ExcelData, emailSubject: string): void;
}

