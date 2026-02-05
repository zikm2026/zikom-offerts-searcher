import { EventEmitter } from 'events';
import { EmailServiceConfig, EmailMessage, AnalyzedEmail } from '../../types/email';
import logger from '../../utils/logger';
import { GeminiService } from '../gemini';
import ExcelParserService from '../excelParserService';
import { LaptopMatcherService } from '../laptopMatcher';
import NotificationService from '../notificationService';
import EmailStatsService from '../emailStatsService';
import { ImapConnection } from './imap/ImapConnection';
import { ImapMessageFetcher } from './imap/ImapMessageFetcher';
import { ImapReconnectManager } from './imap/ImapReconnectManager';
import { EmailProcessor } from './processors/EmailProcessor';
import { GeminiEmailAnalyzer } from './adapters/GeminiEmailAnalyzer';
import { ExcelParserAdapter } from './adapters/ExcelParserAdapter';
import { LaptopMatcherAdapter } from './adapters/LaptopMatcherAdapter';
import { NotificationServiceAdapter } from './adapters/NotificationServiceAdapter';
import { EmailStatsServiceAdapter } from './adapters/EmailStatsServiceAdapter';
import { EmailLoggerAdapter } from './adapters/EmailLoggerAdapter';
import { IEmailAnalyzer } from './interfaces/IEmailAnalyzer';
import { IExcelParser } from './interfaces/IExcelParser';
import { ILaptopMatcher } from './interfaces/ILaptopMatcher';
import { INotificationService } from './interfaces/INotificationService';
import { IEmailStatsService } from './interfaces/IEmailStatsService';
import { IEmailLogger } from './interfaces/IEmailLogger';

class EmailService extends EventEmitter {
  private config: EmailServiceConfig;
  private imapConnection: ImapConnection;
  private messageFetcher: ImapMessageFetcher | null = null;
  private reconnectManager: ImapReconnectManager;
  private emailProcessor: EmailProcessor;
  private checkInterval: NodeJS.Timeout | null = null;
  private isChecking = false;

  constructor(
    config: EmailServiceConfig,
    geminiService?: GeminiService,
    notificationService?: NotificationService
  ) {
    super();
    this.config = config;

    const excelParserService = new ExcelParserService();
    const excelParser: IExcelParser = new ExcelParserAdapter(excelParserService);
    
    const laptopMatcherService = new LaptopMatcherService();
    const laptopMatcher: ILaptopMatcher = new LaptopMatcherAdapter(laptopMatcherService);
    
    const statsService = new EmailStatsService();
    const emailStats: IEmailStatsService = new EmailStatsServiceAdapter(statsService);
    
    const emailLogger: IEmailLogger = new EmailLoggerAdapter();

    let emailAnalyzer: IEmailAnalyzer | null = null;
    if (geminiService) {
      excelParserService.setGeminiService(geminiService);
      emailAnalyzer = new GeminiEmailAnalyzer(geminiService);
      logger.info('Email service initialized with Gemini AI analysis (email + Excel)');
    } else {
      logger.warn('Email service initialized without AI analysis (no Gemini API key)');
    }

    let notification: INotificationService | null = null;
    if (notificationService) {
      notification = new NotificationServiceAdapter(notificationService);
      logger.info('Email service initialized with notification service');
    }

    this.imapConnection = new ImapConnection(config);
    this.setupImapEventHandlers();

    this.reconnectManager = new ImapReconnectManager(async () => {
      await this.imapConnection.connect();
      const imap = this.imapConnection.getImap();
      if (imap) {
        this.messageFetcher = new ImapMessageFetcher(imap);
        await this.checkForNewMessages();
        await this.startChecking();
      }
    });

    this.emailProcessor = new EmailProcessor(
      emailAnalyzer,
      excelParser,
      laptopMatcher,
      notification,
      emailStats,
      emailLogger,
      geminiService || null
    );
  }

  private setupImapEventHandlers(): void {
    this.imapConnection.on('connected', () => {
      const imap = this.imapConnection.getImap();
      if (imap) {
        this.messageFetcher = new ImapMessageFetcher(imap);
      }
      this.emit('connected');
    });

    this.imapConnection.on('disconnected', () => {
      if (!this.reconnectManager.getIsShuttingDown()) {
        this.reconnectManager.scheduleReconnect();
      }
      this.emit('disconnected');
    });

    this.imapConnection.on('error', (error) => {
      this.emit('error', error);
    });
  }

  async connect(): Promise<void> {
    await this.imapConnection.connect();
  }

  async disconnect(): Promise<void> {
    this.reconnectManager.stop();

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    await this.imapConnection.disconnect();
  }

  async startChecking(): Promise<void> {
    if (!this.imapConnection.getIsConnected()) {
      await this.connect();
    }

    await this.checkForNewMessages();

    this.checkInterval = setInterval(async () => {
      try {
        await this.checkForNewMessages();
      } catch (error) {
        logger.error('Error during scheduled email check:', error);
        if (!this.imapConnection.getIsConnected()) {
          try {
            await this.connect();
          } catch (reconnectError) {
            logger.error('Failed to reconnect email service:', reconnectError);
          }
        }
      }
    }, this.config.checkInterval);

    logger.info(`Email checking started. Interval: ${this.config.checkInterval / 1000}s`);
  }

  stopChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Email checking stopped');
    }
  }

  private async checkForNewMessages(): Promise<void> {
    if (this.isChecking) {
      logger.debug('Check already in progress, skipping this cycle');
      return;
    }
    if (!this.imapConnection.getIsConnected()) {
      logger.debug('IMAP disconnected, skipping this check (reconnect in progress or scheduled)');
      return;
    }
    if (!this.messageFetcher) {
      logger.warn('Message fetcher not initialized');
      return;
    }
    try {
      this.isChecking = true;
      const messages = await this.messageFetcher.fetchNewMessages();

      if (messages.length > 0) {
        logger.info(`Found ${messages.length} new email(s)`);

        const timeoutMs = this.config.processTimeoutMs ?? 120000;

        for (const message of messages) {
          console.log('New Mail');
          logger.info(`📧 New email from: ${message.from}, subject: ${message.subject}`);

          const analyzedMessage = await this.processEmailWithTimeout(message, timeoutMs);
          if (analyzedMessage !== null) {
            this.emit('newMail', analyzedMessage);
          }

          try {
            await this.messageFetcher.markAsSeen(message.uid);
          } catch {
            logger.warn('Error marking email as seen');
          }
        }
      } else {
        logger.debug('No new emails found');
      }
    } catch (error) {
      logger.error('Error checking for new messages:', error);
      throw error;
    } finally {
      this.isChecking = false;
    }
  }
  
  private async processEmailWithTimeout(
    message: EmailMessage,
    timeoutMs: number
  ): Promise<AnalyzedEmail | null> {
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs)
    );
    try {
      const result = await Promise.race([
        this.emailProcessor.processEmail(message),
        timeoutPromise,
      ]);
      if (result === null) {
        logger.warn(
          `⏱️ Przetwarzanie maila przerwane (timeout ${timeoutMs / 1000}s): ${message.subject}`
        );
      }
      return result;
    } catch (error) {
      logger.error(`Error processing email "${message.subject}":`, error);
      return null;
    }
  }

  getStatus(): {
    connected: boolean;
    checking: boolean;
    lastCheckedUid: number;
  } {
    return {
      connected: this.imapConnection.getIsConnected(),
      checking: this.checkInterval !== null,
      lastCheckedUid: this.messageFetcher?.getLastCheckedUid() || 0,
    };
  }
}

export default EmailService;

