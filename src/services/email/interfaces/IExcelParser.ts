import { ExcelData, MonitorData, DesktopData } from '../../../types/email';

export interface IExcelParser {
  parseExcel(buffer: Buffer): Promise<ExcelData>;
  parseExcelMonitors(buffer: Buffer): Promise<MonitorData>;
  parseExcelDesktops(buffer: Buffer): Promise<DesktopData>;
}

