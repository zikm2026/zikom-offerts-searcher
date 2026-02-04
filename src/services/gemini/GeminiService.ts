import { EmailMessage, OfferAnalysis, ExcelData } from '../../types/email';
import logger from '../../utils/logger';
import { GeminiClient } from './GeminiClient';
import { DEFAULT_RETRIES } from './types';
import { isRetryableError, getRetryDelayMs } from './retry';
import {
  createEmailAnalysisPrompt,
  createExcelParsingPrompt,
  createEmailContentParsingPrompt,
} from './prompts';
import { prepareEmailContent } from './content';
import { parseOfferAnalysisResponse } from './parsers';
import { parseExcelResponse, parseEmailContentResponse } from './parsers';
import { fallbackOfferAnalysis } from './fallbacks';
import { fillMissingFromEmailText } from './fallbacks';
import type { GeminiConfig } from './types';

const EXCEL_CHUNK_ROWS = 18;

export class GeminiService {
  private client: GeminiClient;

  constructor(config: GeminiConfig) {
    this.client = new GeminiClient(config);
  }

  async analyzeEmailOffer(email: EmailMessage, retries: number = DEFAULT_RETRIES): Promise<OfferAnalysis> {
    try {
      logger.debug(`Analyzing email from ${email.from} with subject: ${email.subject}`);

      const emailContent = prepareEmailContent(email, 4000, true);
      const prompt = createEmailAnalysisPrompt(emailContent);
      const text = await this.client.generateContent(prompt, retries);

      logger.debug(`Gemini raw response: ${text}`);
      return parseOfferAnalysisResponse(text);
    } catch (error: unknown) {
      if (isRetryableError(error) && retries > 0) {
        const delay = getRetryDelayMs(retries);
        logger.warn(
          `Gemini API error (${(error as { status?: number })?.status ?? 'unknown'}): ${(error as Error)?.message ?? 'Service unavailable'}. Retrying in ${delay}ms... (${retries} attempts left)`
        );
        await this.sleep(delay);
        return this.analyzeEmailOffer(email, retries - 1);
      }

      logger.error('Error analyzing email with Gemini:', error);
      if (isRetryableError(error)) {
        logger.warn('⚠️  Gemini API is overloaded/unavailable. Using fallback analysis.');
      }
      return fallbackOfferAnalysis(email);
    }
  }

  async parseExcelData(excelJson: unknown[][], retries: number = DEFAULT_RETRIES): Promise<ExcelData> {
    try {
      const totalRows = excelJson.length;
      logger.debug(`📊 Wysyłam Excel do Gemini AI (${totalRows} wierszy)...`);

      if (totalRows <= EXCEL_CHUNK_ROWS) {
        const prompt = createExcelParsingPrompt(excelJson);
        const text = await this.client.generateContent(prompt, retries);
        logger.debug(`Gemini Excel response (first 500 chars): ${text.substring(0, 500)}`);
        return parseExcelResponse(text);
      }

      const header = excelJson[0];
      const dataRows = excelJson.slice(1);
      const numChunks = Math.ceil(dataRows.length / EXCEL_CHUNK_ROWS);
      logger.info(`📊 Excel duży (${dataRows.length} wierszy) – parsowanie w ${numChunks} częściach po ${EXCEL_CHUNK_ROWS} wierszy`);

      const allLaptops: ExcelData['laptops'] = [];
      let grade: string | undefined;
      let totalPrice: string | undefined;

      for (let i = 0; i < dataRows.length; i += EXCEL_CHUNK_ROWS) {
        const chunkIndex = Math.floor(i / EXCEL_CHUNK_ROWS) + 1;
        logger.info(`📊 Część ${chunkIndex}/${numChunks} (wiersze ${i + 1}–${Math.min(i + EXCEL_CHUNK_ROWS, dataRows.length)})...`);
        const chunk = [header, ...dataRows.slice(i, i + EXCEL_CHUNK_ROWS)];
        const prompt = createExcelParsingPrompt(chunk);
        const text = await this.client.generateContent(prompt, retries);
        const parsed = parseExcelResponse(text);
        allLaptops.push(...parsed.laptops);
        if (parsed.grade && !grade) grade = parsed.grade;
        if (parsed.totalPrice && !totalPrice) totalPrice = parsed.totalPrice;
        if (i + EXCEL_CHUNK_ROWS < dataRows.length) await this.sleep(400);
      }

      return {
        laptops: allLaptops,
        totalQuantity: allLaptops.length,
        grade: grade || undefined,
        totalPrice: totalPrice || undefined,
      };
    } catch (error: unknown) {
      if (isRetryableError(error) && retries > 0) {
        const delay = getRetryDelayMs(retries);
        logger.warn(
          `Gemini API error during Excel parsing: ${(error as Error)?.message}. Retrying in ${delay}ms... (${retries} attempts left)`
        );
        await this.sleep(delay);
        return this.parseExcelData(excelJson, retries - 1);
      }

      logger.error('Failed to parse Excel with Gemini:', error);
      throw error;
    }
  }

  async parseEmailContent(email: EmailMessage, retries: number = DEFAULT_RETRIES): Promise<ExcelData> {
    try {
      logger.debug(`📧 Wysyłam treść maila do Gemini AI do wyciągnięcia danych o laptopach...`);

      const emailContent = prepareEmailContent(email, 16000, true);
      const prompt = createEmailContentParsingPrompt(emailContent);
      const text = await this.client.generateContent(prompt, retries);

      logger.debug(`Gemini email content response (first 500 chars): ${text.substring(0, 500)}`);

      const excelData = parseEmailContentResponse(text);
      const rawText = [email.text || '', (email.html || '').replace(/<[^>]*>/g, ' ')].join(' ');
      fillMissingFromEmailText(excelData.laptops, rawText);
      return excelData;
    } catch (error: unknown) {
      if (isRetryableError(error) && retries > 0) {
        const delay = getRetryDelayMs(retries);
        logger.warn(
          `Gemini API error during email content parsing: ${(error as Error)?.message}. Retrying in ${delay}ms... (${retries} attempts left)`
        );
        await this.sleep(delay);
        return this.parseEmailContent(email, retries - 1);
      }

      logger.warn(
        `Gemini API limit/error (429 lub niedostępność) – nie wyciągnięto laptopów z treści maila. Zwracam pustą listę.`
      );
      return { laptops: [], totalQuantity: 0 };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const text = await this.client.generateContent('Test connection. Respond with "OK".', 1);
      logger.info('Gemini connection test successful');
      return text.toLowerCase().includes('ok');
    } catch (error) {
      logger.error('Gemini connection test failed:', error);
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
