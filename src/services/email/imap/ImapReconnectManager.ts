import { EventEmitter } from 'events';
import logger from '../../../utils/logger';

export class ImapReconnectManager extends EventEmitter {
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 5000;
  private isShuttingDown: boolean = false;
  private reconnectCallback: () => Promise<void>;

  constructor(reconnectCallback: () => Promise<void>) {
    super();
    this.reconnectCallback = reconnectCallback;
  }

  scheduleReconnect(): void {
    if (this.reconnectTimeout || this.isShuttingDown) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);

    logger.warn(`📡 Attempting to reconnect in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;

      try {
        logger.info('🔄 Reconnecting to email server...');
        await this.reconnectCallback();
        this.reconnectAttempts = 0;
        logger.info('✅ Reconnected successfully!');
        this.emit('reconnected');
      } catch (error) {
        logger.error('Failed to reconnect:', error);
        this.scheduleReconnect();
      }
    }, delay);
  }

  stop(): void {
    this.isShuttingDown = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  reset(): void {
    this.reconnectAttempts = 0;
  }

  getIsShuttingDown(): boolean {
    return this.isShuttingDown;
  }
}

