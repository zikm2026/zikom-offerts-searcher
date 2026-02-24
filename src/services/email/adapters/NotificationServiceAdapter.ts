import { INotificationService } from '../interfaces/INotificationService';
import {
  EmailMatchResult,
  MonitorEmailMatchResult,
  DesktopEmailMatchResult,
} from '../../../types/email';
import NotificationService from '../../notificationService';

export class NotificationServiceAdapter implements INotificationService {
  constructor(private notificationService: NotificationService) {}

  async sendLaptopMatchNotification(
    subject: string,
    matchResult: EmailMatchResult
  ): Promise<boolean> {
    return this.notificationService.sendLaptopMatchNotification(subject, matchResult);
  }

  async sendLaptopRejectedNotification(
    subject: string,
    matchResult: EmailMatchResult
  ): Promise<boolean> {
    return this.notificationService.sendLaptopRejectedNotification(subject, matchResult);
  }

  async sendMonitorMatchNotification(
    subject: string,
    matchResult: MonitorEmailMatchResult
  ): Promise<boolean> {
    return this.notificationService.sendMonitorMatchNotification(subject, matchResult);
  }

  async sendMonitorRejectedNotification(
    subject: string,
    matchResult: MonitorEmailMatchResult
  ): Promise<boolean> {
    return this.notificationService.sendMonitorRejectedNotification(subject, matchResult);
  }

  async sendDesktopMatchNotification(
    subject: string,
    matchResult: DesktopEmailMatchResult
  ): Promise<boolean> {
    return this.notificationService.sendDesktopMatchNotification(subject, matchResult);
  }

  async sendDesktopRejectedNotification(
    subject: string,
    matchResult: DesktopEmailMatchResult
  ): Promise<boolean> {
    return this.notificationService.sendDesktopRejectedNotification(subject, matchResult);
  }
}

