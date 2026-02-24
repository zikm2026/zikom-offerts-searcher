import { IDesktopMatcher } from '../interfaces/IDesktopMatcher';
import { DesktopData, DesktopEmailMatchResult } from '../../../types/email';
import { DesktopMatcherService } from '../../desktopMatcher';

export class DesktopMatcherAdapter implements IDesktopMatcher {
  constructor(private service: DesktopMatcherService) {}

  async matchDesktops(desktopData: DesktopData): Promise<DesktopEmailMatchResult> {
    return this.service.matchDesktops(desktopData);
  }
}
