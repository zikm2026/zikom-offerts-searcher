import { INotificationService } from '../interfaces/INotificationService';
import { EmailMatchResult } from '../../../types/email';
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
}

