import { EmailMessage, AnalyzedEmail, ExcelData, MonitorData, DesktopData, OfferType } from '../../../types/email';
import logger from '../../../utils/logger';
import { IEmailAnalyzer } from '../interfaces/IEmailAnalyzer';
import { IExcelParser } from '../interfaces/IExcelParser';
import { ILaptopMatcher } from '../interfaces/ILaptopMatcher';
import { IMonitorMatcher } from '../interfaces/IMonitorMatcher';
import { IDesktopMatcher } from '../interfaces/IDesktopMatcher';
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
    private geminiService: GeminiService | null = null,
    private monitorMatcher: IMonitorMatcher | null = null,
    private desktopMatcher: IDesktopMatcher | null = null
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
    logger.debug(`📱 Category: ${analysis.category || 'unknown'}, offerType: ${analysis.offerType || 'null'}`);

    const offerType: OfferType | undefined = analysis.offerType || (this.isLaptopOffer(analysis) ? 'laptop' : undefined);

    if (offerType === 'monitor' && this.monitorMatcher) {
      await this.processMonitorOffer(analyzedMessage, message);
      return analyzedMessage;
    }
    if (offerType === 'desktop' && this.desktopMatcher) {
      await this.processDesktopOffer(analyzedMessage, message);
      return analyzedMessage;
    }
    if (offerType === 'laptop' || !offerType) {
      if (!this.isLaptopOffer(analysis)) {
        logger.info(`⏭️ Oferta nie dotyczy laptopów (${analysis.category || '?'}) – pomijam`);
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

    await this.statsService.recordEmailStat({
      status: 'rejected',
      reason: `Nieobsługiwany typ oferty: ${offerType}`,
      subject: message.subject,
      from: message.from,
    });
    return analyzedMessage;
  }

  private async processMonitorOffer(_analyzedMessage: AnalyzedEmail, message: EmailMessage): Promise<void> {
    const attachments = (message as any).attachments || [];
    const excelAttachments = attachments.filter((att: any) =>
      att.filename?.toLowerCase().endsWith('.xlsx') || att.filename?.toLowerCase().endsWith('.xls') || att.contentType?.includes('spreadsheet')
    );

    let monitorData: MonitorData = { monitors: [], totalQuantity: 0 };

    if (excelAttachments.length > 0) {
      for (const excelAtt of excelAttachments) {
        if (!excelAtt.content) continue;
        const buffer = Buffer.isBuffer(excelAtt.content) ? excelAtt.content : Buffer.from(excelAtt.content);
        monitorData = await this.excelParser.parseExcelMonitors(buffer);
        if (monitorData.monitors.length > 0) break;
      }
    }
    if (monitorData.monitors.length === 0 && this.geminiService) {
      try {
        monitorData = await this.geminiService.parseEmailContentMonitors(message);
      } catch (e) {
        logger.error('Error parsing email content for monitors:', e);
      }
    }

    if (monitorData.monitors.length === 0) {
      await this.statsService.recordEmailStat({
        status: 'rejected',
        reason: 'Brak danych monitorów w mailu',
        subject: message.subject,
        from: message.from,
        productType: 'monitor',
      });
      return;
    }

    const matchResult = await this.monitorMatcher!.matchMonitors(monitorData);
    if (matchResult.shouldNotify) {
      await this.statsService.recordEmailStat({
        status: 'accepted',
        subject: message.subject,
        from: message.from,
        productType: 'monitor',
      });
      if (this.notificationService) {
        try {
          await this.notificationService.sendMonitorMatchNotification(message.subject, matchResult);
        } catch (e) {
          logger.error('Error sending monitor notification:', e);
        }
      }
    } else {
      await this.statsService.recordEmailStat({
        status: 'rejected',
        reason: matchResult.allMatched ? 'Ceny za wysokie' : 'Nie wszystkie monitory w bazie',
        subject: message.subject,
        from: message.from,
        productType: 'monitor',
      });
      if (this.notificationService && matchResult.matches.length > 0) {
        try {
          await this.notificationService.sendMonitorRejectedNotification(message.subject, matchResult);
        } catch (e) {
          logger.error('Error sending monitor rejected notification:', e);
        }
      }
    }
  }

  private async processDesktopOffer(_analyzedMessage: AnalyzedEmail, message: EmailMessage): Promise<void> {
    const attachments = (message as any).attachments || [];
    const excelAttachments = attachments.filter((att: any) =>
      att.filename?.toLowerCase().endsWith('.xlsx') || att.filename?.toLowerCase().endsWith('.xls') || att.contentType?.includes('spreadsheet')
    );

    let desktopData: DesktopData = { desktops: [], totalQuantity: 0 };

    if (excelAttachments.length > 0) {
      for (const excelAtt of excelAttachments) {
        if (!excelAtt.content) continue;
        const buffer = Buffer.isBuffer(excelAtt.content) ? excelAtt.content : Buffer.from(excelAtt.content);
        desktopData = await this.excelParser.parseExcelDesktops(buffer);
        if (desktopData.desktops.length > 0) break;
      }
    }
    if (desktopData.desktops.length === 0 && this.geminiService) {
      try {
        logger.debug('📧 Brak załącznika Excel – wyciągam dane PC z treści maila...');
        desktopData = await this.geminiService.parseEmailContentDesktops(message);
        if (desktopData.desktops.length > 0) {
          logger.info(`✅ Wyciągnięto ${desktopData.desktops.length} PC z treści maila`);
        } else {
          logger.warn('⚠️ Gemini nie zwróciło żadnego PC z treści maila (pusta tablica desktops)');
        }
      } catch (e) {
        logger.error('Error parsing email content for desktops:', e);
      }
    }

    if (desktopData.desktops.length === 0) {
      logger.debug('❌ Oferta PC odrzucona: brak danych PC w mailu (nie wyciągnięto z treści ani z Excel)');
      await this.statsService.recordEmailStat({
        status: 'rejected',
        reason: 'Brak danych PC w mailu',
        subject: message.subject,
        from: message.from,
        productType: 'desktop',
      });
      return;
    }

    const matchResult = await this.desktopMatcher!.matchDesktops(desktopData);
    if (matchResult.shouldNotify) {
      await this.statsService.recordEmailStat({
        status: 'accepted',
        subject: message.subject,
        from: message.from,
        productType: 'desktop',
      });
      if (this.notificationService) {
        try {
          await this.notificationService.sendDesktopMatchNotification(message.subject, matchResult);
        } catch (e) {
          logger.error('Error sending desktop notification:', e);
        }
      }
    } else {
      await this.statsService.recordEmailStat({
        status: 'rejected',
        reason: matchResult.allMatched ? 'Ceny za wysokie' : 'Nie wszystkie PC w bazie',
        subject: message.subject,
        from: message.from,
        productType: 'desktop',
      });
      if (this.notificationService && matchResult.matches.length > 0) {
        try {
          await this.notificationService.sendDesktopRejectedNotification(message.subject, matchResult);
        } catch (e) {
          logger.error('Error sending desktop rejected notification:', e);
        }
      }
    }
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
        productType: 'laptop',
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
        productType: 'laptop',
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
        productType: 'laptop',
      });

      if (this.notificationService && result.matchResult.matches.length > 0) {
        try {
          await this.notificationService.sendLaptopRejectedNotification(
            message.subject,
            result.matchResult
          );
        } catch (notificationError) {
          logger.error('Error sending rejected-laptops notification:', notificationError);
        }
      }
    }
  }
}

