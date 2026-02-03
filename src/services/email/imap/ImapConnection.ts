import Imap from 'imap';
import { EventEmitter } from 'events';
import { EmailServiceConfig } from '../../../types/email';
import logger from '../../../utils/logger';

export interface ImapConnectionEvents {
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
}

export class ImapConnection extends EventEmitter {
  private imap: Imap | null = null;
  private config: EmailServiceConfig;
  private isConnected: boolean = false;
  private isShuttingDown: boolean = false;

  constructor(config: EmailServiceConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected && this.imap) {
        logger.info('IMAP already connected');
        resolve();
        return;
      }

      logger.info(`Connecting to email server: ${this.config.host}:${this.config.port}`);
      logger.debug(`Email user: ${this.config.user}`);
      logger.debug(`Password length: ${this.config.password.length} characters`);
      logger.debug(`TLS enabled: ${this.config.tls}`);

      this.imap = new Imap({
        user: this.config.user,
        password: this.config.password,
        host: this.config.host,
        port: this.config.port,
        tls: this.config.tls,
        tlsOptions: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
        debug: undefined,
      });

      this.setupEventHandlers(resolve, reject);
      this.imap.connect();
    });
  }

  private setupEventHandlers(resolve: () => void, reject: (error: Error) => void): void {
    if (!this.imap) return;

    this.imap.once('ready', () => {
      logger.info('IMAP connected successfully');
      this.isConnected = true;
      this.emit('connected');
      resolve();
    });

    this.imap.once('error', (err: any) => {
      this.isConnected = false;
      this.handleError(err);
      this.emit('error', err);
      reject(err);
    });

    this.imap.once('end', () => {
      logger.warn('IMAP connection ended');
      this.isConnected = false;
      this.emit('disconnected');
    });

    this.imap.once('close', (hadError: boolean) => {
      logger.warn(`IMAP connection closed ${hadError ? 'with error' : 'normally'}`);
      this.isConnected = false;
    });
  }

  private handleError(err: any): void {
    const errorText = err.text || err.message || '';
    const isAuthError =
      err.source === 'authentication' ||
      err.type === 'no' ||
      errorText.toLowerCase().includes('auth') ||
      errorText.toLowerCase().includes('logowanie') ||
      errorText.toLowerCase().includes('password') ||
      errorText.toLowerCase().includes('hasło') ||
      errorText.toLowerCase().includes('internal server error') ||
      errorText.toLowerCase().includes('bad');

    if (isAuthError) {
      this.logAuthError(errorText, err);
    } else {
      this.logConnectionError(errorText, err);
    }
  }

  private logAuthError(errorText: string, err: any): void {
    const errorMessage = err.message || err.text || 'Authentication failed';

    if (errorText.toLowerCase().includes('internal server error') || errorText.toLowerCase().includes('bad')) {
      logger.error('❌ IMAP Authentication Error: Internal Server Error');
      logger.warn('');
      logger.warn('🔍 DIAGNOSTYKA:');
      logger.warn('  1. Sprawdź czy hasło aplikacji w .env jest poprawne');
      logger.warn('  2. Upewnij się, że NIE MA spacji w haśle');
      logger.warn('  3. Sprawdź hasło w Panelu Klienta (home.pl)');
      logger.warn('  4. Sprawdź czy IMAP jest włączony (Poczta → Opcje → Serwery pocztowe)');
      logger.warn('');
    }

    logger.error('Email authentication failed:', errorMessage);
    logger.warn('');
    logger.warn('╔════════════════════════════════════════════════════════════╗');
    logger.warn('║  AUTHENTICATION FAILED - Possible causes:                  ║');
    logger.warn('╠════════════════════════════════════════════════════════════╣');
    logger.warn('║  1. Email or password is incorrect                         ║');
    logger.warn('║  2. IMAP access is not enabled                             ║');
    logger.warn('║  3. ⚠️  2FA is enabled - use App Password instead!         ║');
    logger.warn('║                                                            ║');
    logger.warn('║  For home.pl:                                              ║');
    logger.warn('║  • Go to: https://poczta.home.pl                           ║');
    logger.warn('║  • Enable IMAP in mailbox settings (Panel Klienta)         ║');
    logger.warn('║  • Use your mailbox password in EMAIL_PASSWORD in .env     ║');
    logger.warn('║                                                            ║');
    logger.warn('║  For Gmail with 2FA:                                       ║');
    logger.warn('║  • Go to: https://myaccount.google.com/apppasswords        ║');
    logger.warn('║  • Generate app password and use it in .env                ║');
    logger.warn('╚════════════════════════════════════════════════════════════╝');
    logger.warn('');
  }

  private logConnectionError(errorText: string, err?: any): void {
    logger.error('Email service connection error');
    const isHostNotFound =
      err?.code === 'ENOTFOUND' ||
      (typeof errorText === 'string' && errorText.toLowerCase().includes('enotfound'));
    if (isHostNotFound) {
      logger.warn('');
      logger.warn('╔════════════════════════════════════════════════════════════╗');
      logger.warn('║  HOST NOT FOUND (ENOTFOUND)                                ║');
      logger.warn('╠════════════════════════════════════════════════════════════╣');
      logger.warn('║  Nie można znaleźć serwera IMAP (sprawdź EMAIL_HOST).     ║');
      logger.warn('║                                                            ║');
      logger.warn('║  Dla home.pl: host to NIE jest imap.home.pl!               ║');
      logger.warn('║  • Panel Klienta → Poczta → Opcje skrzynki → Serwery      ║');
      logger.warn('║  • Skopiuj adres "Serwer IMAP" (np. serwer123.home.pl)     ║');
      logger.warn('║  • W .env ustaw: EMAIL_HOST=serwerXXX.home.pl             ║');
      logger.warn('╚════════════════════════════════════════════════════════════╝');
      logger.warn('');
      return;
    }
    if (errorText.includes('internal server error')) {
      logger.warn('');
      logger.warn('╔════════════════════════════════════════════════════════════╗');
      logger.warn('║  INTERNAL SERVER ERROR                                     ║');
      logger.warn('╠════════════════════════════════════════════════════════════╣');
      logger.warn('║  The email server returned an internal error.              ║');
      logger.warn('║  This usually means:                                       ║');
      logger.warn('║                                                            ║');
      logger.warn('║  1. ⚠️  App password is incorrect or expired               ║');
      logger.warn('║     → Check if you copied it correctly (no spaces)         ║');
      logger.warn('║     → Try generating a new app password                    ║');
      logger.warn('║                                                            ║');
      logger.warn('║  2. ⏱️  App password not activated yet                     ║');
      logger.warn('║     → Wait 2-3 minutes and try again                       ║');
      logger.warn('║                                                            ║');
      logger.warn('║  3. 🔧 Temporary server issue                              ║');
      logger.warn('║     → Try again in a few minutes                           ║');
      logger.warn('║                                                            ║');
      logger.warn('║  4. 🔐 Regular password used instead of app password       ║');
      logger.warn('║     → Make sure you are using the app password             ║');
      logger.warn('╚════════════════════════════════════════════════════════════╝');
      logger.warn('');
    }
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      this.isShuttingDown = true;

      if (this.imap && this.isConnected) {
        this.imap.end();
        this.imap.once('end', () => {
          logger.info('IMAP disconnected');
          this.isConnected = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getImap(): Imap | null {
    return this.imap;
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  getIsShuttingDown(): boolean {
    return this.isShuttingDown;
  }
}

