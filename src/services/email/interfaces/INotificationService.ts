import { EmailMatchResult } from '../../../types/email';

export interface INotificationService {
  sendLaptopMatchNotification(subject: string, matchResult: EmailMatchResult): Promise<boolean>;
  sendLaptopRejectedNotification(subject: string, matchResult: EmailMatchResult): Promise<boolean>;
}

