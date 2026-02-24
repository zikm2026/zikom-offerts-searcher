import { MonitorData, MonitorEmailMatchResult } from '../../../types/email';

export interface IMonitorMatcher {
  matchMonitors(monitorData: MonitorData): Promise<MonitorEmailMatchResult>;
}
