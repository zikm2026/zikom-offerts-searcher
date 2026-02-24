import { NtfyConfig } from '../config/index';
import logger from '../utils/logger';
import {
  EmailMatchResult,
  MonitorEmailMatchResult,
  DesktopEmailMatchResult,
} from '../types/email';

interface NotificationOptions {
  title: string;
  message: string;
  priority?: 'min' | 'low' | 'default' | 'high' | 'max';
  tags?: string[];
}

function headerSafe(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L');
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
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Title': headerSafe(options.title),
        'X-Priority': options.priority || 'high',
      };

      if (options.tags && options.tags.length > 0) {
        headers['X-Tags'] = options.tags.map(headerSafe).join(',');
      }

      if (this.config.token) {
        headers['Authorization'] = `Bearer ${this.config.token}`;
      }

      const body = Buffer.from(options.message, 'utf-8');

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
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
    const rejectedLaptops = matchResult.matches.filter(m => !m.isMatch);

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

    if (rejectedLaptops.length > 0) {
      message += `\n\n--- Odrzucone (${rejectedLaptops.length}) ---\n\n`;
      rejectedLaptops.forEach((match, index) => {
        const laptop = match.laptop;
        message += `${index + 1}. ${laptop.model || 'Unknown'}\n`;
        message += `   Powód: ${match.reason}\n`;
        if (laptop.price) {
          message += `   Cena w ofercie: ${laptop.price}\n`;
        }
        message += '\n';
      });
    }

    return this.sendNotificationWithRetry({
      title,
      message,
      priority: 'high',
      tags: ['laptop', 'offer', 'match'],
    });
  }

  async sendLaptopRejectedNotification(
    emailSubject: string,
    matchResult: EmailMatchResult
  ): Promise<boolean> {
    if (!this.config.enabled) {
      logger.debug('🔕 Powiadomienia ntfy.sh są wyłączone');
      return false;
    }

    const rejectedLaptops = matchResult.matches.filter(m => !m.isMatch);
    if (rejectedLaptops.length === 0) {
      return false;
    }

    const title = `Oferta bez pasujących laptopów (${rejectedLaptops.length} odrzuconych)`;
    let message = `Email: ${emailSubject}\n\n`;
    message += `Żaden laptop nie spełnił kryteriów. Odrzucone:\n\n`;

    rejectedLaptops.forEach((match, index) => {
      const laptop = match.laptop;
      message += `${index + 1}. ${laptop.model || 'Unknown'}\n`;
      message += `   Powód: ${match.reason}\n`;
      if (laptop.price) message += `   Cena: ${laptop.price}\n`;
      if (laptop.ram) message += `   RAM: ${laptop.ram}\n`;
      message += '\n';
    });

    message += `Statystyki: 0/${matchResult.totalCount} laptopów spełnia kryteria`;

    return this.sendNotificationWithRetry({
      title,
      message,
      priority: 'default',
      tags: ['laptop', 'offer', 'rejected'],
    });
  }

  async sendMonitorMatchNotification(
    emailSubject: string,
    matchResult: MonitorEmailMatchResult
  ): Promise<boolean> {
    if (!this.config.enabled) return false;
    const matched = matchResult.matches.filter(m => m.isMatch);
    const rejected = matchResult.matches.filter(m => !m.isMatch);
    if (matched.length === 0) return false;

    const title = `Znaleziono ${matched.length} monitor(ow) w ofercie!`;
    let message = `Email: ${emailSubject}\n\n`;
    matched.forEach((m, i) => {
      message += `${i + 1}. ${m.monitor.model || 'Monitor'}\n`;
      if (m.monitor.sizeInches) message += `   Wielkosc: ${m.monitor.sizeInches}"\n`;
      if (m.monitor.resolution) message += `   Rozdzielczosc: ${m.monitor.resolution}\n`;
      if (m.monitor.price) message += `   Cena: ${m.monitor.price}\n`;
      message += '\n';
    });
    message += `Statystyki: ${matchResult.matchedCount}/${matchResult.totalCount} monitorow spelnia kryteria`;
    if (rejected.length > 0) {
      message += `\n\n--- Odrzucone (${rejected.length}) ---\n\n`;
      rejected.forEach((m, i) => {
        message += `${i + 1}. ${m.monitor.model || 'Monitor'}\n   Powod: ${m.reason}\n\n`;
      });
    }
    return this.sendNotificationWithRetry({
      title,
      message,
      priority: 'high',
      tags: ['monitor', 'offer', 'match'],
    });
  }

  async sendMonitorRejectedNotification(
    emailSubject: string,
    matchResult: MonitorEmailMatchResult
  ): Promise<boolean> {
    if (!this.config.enabled) return false;
    const rejected = matchResult.matches.filter(m => !m.isMatch);
    if (rejected.length === 0) return false;
    const title = `Oferta monitorow bez pasujacych (${rejected.length} odrzuconych)`;
    let message = `Email: ${emailSubject}\n\n`;
    rejected.forEach((m, i) => {
      message += `${i + 1}. ${m.monitor.model || 'Monitor'}\n   Powod: ${m.reason}\n`;
      if (m.monitor.price) message += `   Cena: ${m.monitor.price}\n`;
      message += '\n';
    });
    return this.sendNotificationWithRetry({
      title,
      message,
      priority: 'default',
      tags: ['monitor', 'offer', 'rejected'],
    });
  }

  async sendDesktopMatchNotification(
    emailSubject: string,
    matchResult: DesktopEmailMatchResult
  ): Promise<boolean> {
    if (!this.config.enabled) return false;
    const matched = matchResult.matches.filter(m => m.isMatch);
    const rejected = matchResult.matches.filter(m => !m.isMatch);
    if (matched.length === 0) return false;

    const title = `Znaleziono ${matched.length} PC w ofercie!`;
    let message = `Email: ${emailSubject}\n\n`;
    matched.forEach((m, i) => {
      message += `${i + 1}. ${m.desktop.model || 'PC'}\n`;
      if (m.desktop.caseType) message += `   Obudowa: ${m.desktop.caseType}\n`;
      if (m.desktop.ram) message += `   RAM: ${m.desktop.ram}\n`;
      if (m.desktop.storage) message += `   Dysk: ${m.desktop.storage}\n`;
      if (m.desktop.price) message += `   Cena: ${m.desktop.price}\n`;
      message += '\n';
    });
    message += `Statystyki: ${matchResult.matchedCount}/${matchResult.totalCount} PC spelnia kryteria`;
    if (rejected.length > 0) {
      message += `\n\n--- Odrzucone (${rejected.length}) ---\n\n`;
      rejected.forEach((m, i) => {
        message += `${i + 1}. ${m.desktop.model || 'PC'}\n   Powod: ${m.reason}\n\n`;
      });
    }
    return this.sendNotificationWithRetry({
      title,
      message,
      priority: 'high',
      tags: ['desktop', 'offer', 'match'],
    });
  }

  async sendDesktopRejectedNotification(
    emailSubject: string,
    matchResult: DesktopEmailMatchResult
  ): Promise<boolean> {
    if (!this.config.enabled) return false;
    const rejected = matchResult.matches.filter(m => !m.isMatch);
    if (rejected.length === 0) return false;
    const title = `Oferta PC bez pasujacych (${rejected.length} odrzuconych)`;
    let message = `Email: ${emailSubject}\n\n`;
    rejected.forEach((m, i) => {
      message += `${i + 1}. ${m.desktop.model || 'PC'}\n   Powod: ${m.reason}\n`;
      if (m.desktop.price) message += `   Cena: ${m.desktop.price}\n`;
      message += '\n';
    });
    return this.sendNotificationWithRetry({
      title,
      message,
      priority: 'default',
      tags: ['desktop', 'offer', 'rejected'],
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

