import { DesktopData, DesktopEmailMatchResult } from '../../../types/email';

export interface IDesktopMatcher {
  matchDesktops(desktopData: DesktopData): Promise<DesktopEmailMatchResult>;
}
