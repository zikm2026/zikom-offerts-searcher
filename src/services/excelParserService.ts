import * as XLSX from 'xlsx';
import { ExcelData, MonitorData, DesktopData } from '../types/email';
import logger from '../utils/logger';
import { GeminiService } from './gemini';

class ExcelParserService {
  private geminiService: GeminiService | null = null;

  setGeminiService(geminiService: GeminiService): void {
    this.geminiService = geminiService;
  }

  private bufferToJson(buffer: Buffer): unknown[][] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false }) as unknown[][];
  }

  async parseExcel(buffer: Buffer): Promise<ExcelData> {
    try {
      const jsonData = this.bufferToJson(buffer);
      logger.debug(`📊 Excel wczytany: ${jsonData.length} wierszy`);

      if (this.geminiService) {
        logger.info(`🤖 Wysyłam Excel do Gemini AI...`);
        const result = await this.geminiService.parseExcelData(jsonData);
        logger.info(`✅ Gemini zwróciło ${result.laptops.length} laptopów`);
        return result;
      }

      logger.warn('⚠️ Gemini nie jest dostępne - nie można sparsować Excela');
      return { laptops: [], totalQuantity: 0 };
    } catch (error) {
      logger.error('❌ Błąd podczas parsowania Excel:', error);
      throw error;
    }
  }

  async parseExcelMonitors(buffer: Buffer): Promise<MonitorData> {
    try {
      const jsonData = this.bufferToJson(buffer);
      logger.debug(`📊 Excel (monitory): ${jsonData.length} wierszy`);
      if (!this.geminiService) return { monitors: [], totalQuantity: 0 };
      const result = await this.geminiService.parseExcelMonitors(jsonData);
      logger.info(`✅ Gemini zwróciło ${result.monitors.length} monitorów`);
      return result;
    } catch (error) {
      logger.error('❌ Błąd parsowania Excel (monitory):', error);
      return { monitors: [], totalQuantity: 0 };
    }
  }

  async parseExcelDesktops(buffer: Buffer): Promise<DesktopData> {
    try {
      const jsonData = this.bufferToJson(buffer);
      logger.debug(`📊 Excel (PC): ${jsonData.length} wierszy`);
      if (!this.geminiService) return { desktops: [], totalQuantity: 0 };
      const result = await this.geminiService.parseExcelDesktops(jsonData);
      logger.info(`✅ Gemini zwróciło ${result.desktops.length} komputerów stacjonarnych`);
      return result;
    } catch (error) {
      logger.error('❌ Błąd parsowania Excel (PC):', error);
      return { desktops: [], totalQuantity: 0 };
    }
  }
}

export default ExcelParserService;
