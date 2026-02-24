import {
  EmailMatchResult,
  MonitorEmailMatchResult,
  DesktopEmailMatchResult,
} from '../../../types/email';

export interface INotificationService {
  sendLaptopMatchNotification(subject: string, matchResult: EmailMatchResult): Promise<boolean>;
  sendLaptopRejectedNotification(subject: string, matchResult: EmailMatchResult): Promise<boolean>;
  sendMonitorMatchNotification(subject: string, matchResult: MonitorEmailMatchResult): Promise<boolean>;
  sendMonitorRejectedNotification(subject: string, matchResult: MonitorEmailMatchResult): Promise<boolean>;
  sendDesktopMatchNotification(subject: string, matchResult: DesktopEmailMatchResult): Promise<boolean>;
  sendDesktopRejectedNotification(subject: string, matchResult: DesktopEmailMatchResult): Promise<boolean>;
}

