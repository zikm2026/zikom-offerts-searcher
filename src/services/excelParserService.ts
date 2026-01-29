import * as XLSX from 'xlsx';
import { ExcelData } from '../types/email';
import logger from '../utils/logger';
import GeminiService from './geminiService';

class ExcelParserService {
  private geminiService: GeminiService | null = null;

  setGeminiService(geminiService: GeminiService): void {
    this.geminiService = geminiService;
  }

  async parseExcel(buffer: Buffer): Promise<ExcelData> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        defval: '',
        raw: false 
      }) as any[][];

      logger.debug(`📊 Excel wczytany: ${jsonData.length} wierszy`);

      if (this.geminiService) {
        logger.info(`🤖 Wysyłam Excel do Gemini AI...`);
        const result = await this.geminiService.parseExcelData(jsonData);
        logger.info(`✅ Gemini zwróciło ${result.laptops.length} laptopów`);
        return result;
      }

      logger.warn('⚠️ Gemini nie jest dostępne - nie można sparsować Excela');
      return {
        laptops: [],
        totalQuantity: 0,
      };
    } catch (error) {
      logger.error('❌ Błąd podczas parsowania Excel:', error);
      throw error;
    }
  }
}

export default ExcelParserService;
