import { EmailMessage, AnalyzedEmail, ExcelData } from '../../../types/email';
import logger from '../../../utils/logger';
import { IEmailAnalyzer } from '../interfaces/IEmailAnalyzer';
import { IExcelParser } from '../interfaces/IExcelParser';
import { ILaptopMatcher } from '../interfaces/ILaptopMatcher';
import { INotificationService } from '../interfaces/INotificationService';
import { IEmailStatsService } from '../interfaces/IEmailStatsService';
import { IEmailLogger } from '../interfaces/IEmailLogger';
import { GeminiService } from '../../../services/gemini';

export interface ProcessResult {
  shouldNotify: boolean;
  reason?: string;
}

export class EmailProcessor {
  constructor(
    private emailAnalyzer: IEmailAnalyzer | null,
    private excelParser: IExcelParser,
    private laptopMatcher: ILaptopMatcher,
    private notificationService: INotificationService | null,
    private statsService: IEmailStatsService,
    private emailLogger: IEmailLogger,
    private geminiService: GeminiService | null = null
  ) {}

  async processEmail(message: EmailMessage): Promise<AnalyzedEmail> {
    await this.statsService.recordEmailStat({
      status: 'processed',
      subject: message.subject,
      from: message.from,
    });

    let analyzedMessage: AnalyzedEmail = message;

    if (this.emailAnalyzer) {
      try {
        analyzedMessage = await this.analyzeWithGemini(message);
      } catch (error) {
        logger.error('Error analyzing email with Gemini:', error);
        logger.info('📧 Email processed without AI analysis');
      }
    } else {
      logger.debug('📧 Email processed (Gemini AI not configured)');
    }

    return analyzedMessage;
  }

  private isLaptopOffer(analysis: NonNullable<AnalyzedEmail['analysis']>): boolean {
    const category = (analysis.category || '').toLowerCase();
    const productType = (analysis.details?.productType || '').toLowerCase();
    if (category === 'laptop' || category === 'laptopy') return true;
    if (productType === 'laptop' || productType === 'laptopy') return true;
    const notLaptop =
      category === 'accessories' ||
      category === 'other' ||
      /monitor|monitory|akcesoria|accessories|komponenty|components/.test(productType);
    return !notLaptop && (category === 'desktop' ? false : true);
  }

  private async analyzeWithGemini(message: EmailMessage): Promise<AnalyzedEmail> {
    logger.debug('🤖 Analyzing email with Gemini AI...');
    const analysis = await this.emailAnalyzer!.analyzeEmailOffer(message);
    const analyzedMessage: AnalyzedEmail = { ...message, analysis };

    if (!analysis.isOffer) {
      logger.debug(`❌ Not a laptop offer (confidence: ${analysis.confidence}%)`);
      await this.statsService.recordEmailStat({
        status: 'rejected',
        reason: `Nie jest ofertą laptopów (confidence: ${analysis.confidence}%)`,
        subject: message.subject,
        from: message.from,
      });
      return analyzedMessage;
    }

    logger.debug(`🎯 OFFER DETECTED! Confidence: ${analysis.confidence}%`);
    logger.debug(`📱 Category: ${analysis.category || 'unknown'}`);

    if (!this.isLaptopOffer(analysis)) {
      logger.info(`⏭️ Oferta nie dotyczy laptopów (${analysis.category || '?'} / ${analysis.details?.productType || '?'}) – pomijam`);
      await this.statsService.recordEmailStat({
        status: 'rejected',
        reason: 'Oferta nie dotyczy laptopów (monitory/akcesoria/inne)',
        subject: message.subject,
        from: message.from,
      });
      analyzedMessage.analysis = { ...analysis, isOffer: false };
      return analyzedMessage;
    }

    await this.processExcelAttachments(analyzedMessage, message);
    return analyzedMessage;
  }

  private async processExcelAttachments(
    analyzedMessage: AnalyzedEmail,
    message: EmailMessage
  ): Promise<void> {
    const attachments = (message as any).attachments || [];
    const excelAttachments = attachments.filter((att: any) =>
      att.filename.toLowerCase().endsWith('.xlsx') ||
      att.filename.toLowerCase().endsWith('.xls') ||
      att.contentType?.includes('spreadsheet') ||
      att.contentType?.includes('excel')
    );

    if (excelAttachments.length === 0) {
      logger.debug('📊 No Excel attachments found in email');
      
      if (this.geminiService) {
        logger.debug('📧 Brak załącznika - próbuję wyciągnąć dane z treści maila...');
        try {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const excelData = await this.geminiService.parseEmailContent(message);
          
          if (excelData.laptops.length > 0) {
            logger.info(`✅ Wyciągnięto ${excelData.laptops.length} laptopów z treści maila`);
            this.emailLogger.logAllLaptops(excelData, message.subject);
            
            const matchResult = await this.laptopMatcher.matchEmailLaptops(excelData);
            analyzedMessage.excelData = excelData;
            await this.handleMatchResult({ excelData, matchResult }, message);
          } else {
            logger.debug('❌ Nie udało się wyciągnąć laptopów z treści maila');
          }
        } catch (error) {
          logger.error('Error parsing email content with Gemini:', error);
        }
      } else {
        logger.debug('⚠️ Gemini nie jest dostępne - nie można wyciągnąć danych z treści maila');
      }
      
      return;
    }

    logger.debug(`📊 Found ${excelAttachments.length} Excel attachment(s), parsing...`);

    let anySucceeded = false;
    for (const excelAtt of excelAttachments) {
      try {
        const result = await this.processExcelAttachment(excelAtt, message);
        if (result) {
          analyzedMessage.excelData = result.excelData;
          await this.handleMatchResult(result, message);
          anySucceeded = true;
        }
      } catch (excelError) {
        logger.error(`Error parsing Excel attachment ${excelAtt.filename}:`, excelError);
      }
    }

    if (!anySucceeded) {
      logger.warn('⏭️ Nie udało się sparsować żadnego załącznika Excel (np. Gemini API niedostępny)');
      await this.statsService.recordEmailStat({
        status: 'rejected',
        reason: 'Błąd parsowania Excel (Gemini API niedostępny lub przeciążony)',
        subject: message.subject,
        from: message.from,
      });
      if (analyzedMessage.analysis) {
        analyzedMessage.analysis = { ...analyzedMessage.analysis, isOffer: false };
      }
    }
  }

  private async processExcelAttachment(
    excelAtt: any,
    message: EmailMessage
  ): Promise<{ excelData: ExcelData; matchResult: any } | null> {
    if (!excelAtt.content) {
      return null;
    }

    const buffer = Buffer.isBuffer(excelAtt.content)
      ? excelAtt.content
      : Buffer.from(excelAtt.content);

    const excelData = await this.excelParser.parseExcel(buffer);
    logger.debug(`📊 Excel parsed successfully! Found ${excelData.laptops.length} laptops`);

    this.emailLogger.logAllLaptops(excelData, message.subject);

    const matchResult = await this.laptopMatcher.matchEmailLaptops(excelData);

    return { excelData, matchResult };
  }

  private async handleMatchResult(
    result: { excelData: ExcelData; matchResult: any },
    message: EmailMessage
  ): Promise<void> {
    if (result.matchResult.shouldNotify) {
      console.log('New Mail');
      this.laptopMatcher.logMatchResults(message.subject, result.matchResult);

      await this.statsService.recordEmailStat({
        status: 'accepted',
        subject: message.subject,
        from: message.from,
      });

      if (this.notificationService) {
        try {
          await this.notificationService.sendLaptopMatchNotification(
            message.subject,
            result.matchResult
          );
        } catch (notificationError) {
          logger.error('Error sending notification:', notificationError);
        }
      }
    } else {
      const reason = result.matchResult.allLaptopsMatched
        ? 'Ceny za wysokie'
        : 'Nie wszystkie laptopy w bazie';
      logger.debug(`❌ Email pominięty: ${reason}`);

      await this.statsService.recordEmailStat({
        status: 'rejected',
        reason,
        subject: message.subject,
        from: message.from,
      });
    }
  }
}

