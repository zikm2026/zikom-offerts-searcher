import { IMonitorMatcher } from '../interfaces/IMonitorMatcher';
import { MonitorData, MonitorEmailMatchResult } from '../../../types/email';
import { MonitorMatcherService } from '../../monitorMatcher';

export class MonitorMatcherAdapter implements IMonitorMatcher {
  constructor(private service: MonitorMatcherService) {}

  async matchMonitors(monitorData: MonitorData): Promise<MonitorEmailMatchResult> {
    return this.service.matchMonitors(monitorData);
  }
}
