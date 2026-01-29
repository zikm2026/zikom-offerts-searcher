import { IExcelParser } from '../interfaces/IExcelParser';
import { ExcelData } from '../../../types/email';
import ExcelParserService from '../../excelParserService';

export class ExcelParserAdapter implements IExcelParser {
  constructor(private excelParserService: ExcelParserService) {}

  async parseExcel(buffer: Buffer): Promise<ExcelData> {
    return this.excelParserService.parseExcel(buffer);
  }
}

