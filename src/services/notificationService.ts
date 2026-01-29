import { NtfyConfig } from '../config/index';
import logger from '../utils/logger';
import { EmailMatchResult } from '../types/email';

interface NotificationOptions {
  title: string;
  message: string;
  priority?: 'min' | 'low' | 'default' | 'high' | 'max';
  tags?: string[];
}

class NotificationService {
  private config: NtfyConfig;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor(config: NtfyConfig) {
    this.config = config;
  }

  private async sendNotificationWithRetry(
    options: NotificationOptions,
    retryCount: number = 0
  ): Promise<boolean> {
    try {
      const url = `${this.config.server}/${this.config.topic}`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain',
        'X-Title': options.title,
        'X-Priority': options.priority || 'high',
      };

      if (options.tags && options.tags.length > 0) {
        headers['X-Tags'] = options.tags.join(',');
      }

      if (this.config.token) {
        headers['Authorization'] = `Bearer ${this.config.token}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: options.message,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`ntfy.sh API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      logger.info(`✅ Powiadomienie wysłane do ntfy.sh (topic: ${this.config.topic})`);
      return true;
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      
      if (retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        logger.warn(
          `⚠️  Błąd wysyłania powiadomienia (próba ${retryCount + 1}/${this.maxRetries}): ${errorMessage}. Retry za ${delay}ms...`
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.sendNotificationWithRetry(options, retryCount + 1);
      }

      logger.error(`❌ Nie udało się wysłać powiadomienia po ${this.maxRetries} próbach: ${errorMessage}`);
      return false;
    }
  }

  async sendLaptopMatchNotification(
    emailSubject: string,
    matchResult: EmailMatchResult
  ): Promise<boolean> {
    if (!this.config.enabled) {
      logger.debug('🔕 Powiadomienia ntfy.sh są wyłączone');
      return false;
    }

    const matchedLaptops = matchResult.matches.filter(m => m.isMatch);
    
    if (matchedLaptops.length === 0) {
      logger.debug('🔕 Brak laptopów spełniających kryteria - powiadomienie nie wysłane');
      return false;
    }

    const title = `Znaleziono ${matchedLaptops.length} laptop(ow) w ofercie!`;
    
    let message = `Email: ${emailSubject}\n\n`;
    message += `Znaleziono ${matchedLaptops.length} laptop(ow) spelniajacych kryteria:\n\n`;

    matchedLaptops.forEach((match, index) => {
      const laptop = match.laptop;
      message += `${index + 1}. ${laptop.model || 'Unknown'}\n`;
      if (laptop.ram) message += `   RAM: ${laptop.ram}\n`;
      if (laptop.storage) message += `   Dysk: ${laptop.storage}\n`;
      if (laptop.price) {
        const maxPriceFormatted = match.maxAllowedPrice.toFixed(2).replace('.', ',');
        message += `   Cena: ${laptop.price} (max: ${maxPriceFormatted} EUR)\n`;
      }
      message += '\n';
    });

    message += `Statystyki: ${matchResult.matchedCount}/${matchResult.totalCount} laptopow spelnia kryteria`;

    return this.sendNotificationWithRetry({
      title,
      message,
      priority: 'high',
      tags: ['laptop', 'offer', 'match'],
    });
  }

  async sendTestNotification(): Promise<boolean> {
    if (!this.config.enabled) {
      logger.warn('🔕 Powiadomienia ntfy.sh są wyłączone');
      return false;
    }

    return this.sendNotificationWithRetry({
      title: 'Test powiadomienia',
      message: 'To jest testowe powiadomienie z Zikom Offers Searcher',
      priority: 'default',
      tags: ['test'],
    });
  }
}

export default NotificationService;

