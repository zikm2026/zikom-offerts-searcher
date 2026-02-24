import { IExcelParser } from '../interfaces/IExcelParser';
import { ExcelData, MonitorData, DesktopData } from '../../../types/email';
import ExcelParserService from '../../excelParserService';

export class ExcelParserAdapter implements IExcelParser {
  constructor(private excelParserService: ExcelParserService) {}

  async parseExcel(buffer: Buffer): Promise<ExcelData> {
    return this.excelParserService.parseExcel(buffer);
  }

  async parseExcelMonitors(buffer: Buffer): Promise<MonitorData> {
    return this.excelParserService.parseExcelMonitors(buffer);
  }

  async parseExcelDesktops(buffer: Buffer): Promise<DesktopData> {
    return this.excelParserService.parseExcelDesktops(buffer);
  }
}

