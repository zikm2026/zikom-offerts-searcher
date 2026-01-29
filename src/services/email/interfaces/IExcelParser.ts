import { ExcelData } from '../../../types/email';

export interface IExcelParser {
  parseExcel(buffer: Buffer): Promise<ExcelData>;
}

