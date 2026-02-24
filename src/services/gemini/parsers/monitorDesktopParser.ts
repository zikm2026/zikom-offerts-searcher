import type { MonitorData, DesktopData } from '../../../types/email';
import logger from '../../../utils/logger';

export function parseMonitorResponse(response: string): MonitorData {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in monitor response');
    const parsed = JSON.parse(jsonMatch[0]);
    const monitors = Array.isArray(parsed.monitors) ? parsed.monitors : [];
    return {
      monitors: monitors.map((m: any) => ({
        model: m.model ?? undefined,
        sizeInches: m.sizeInches ?? undefined,
        resolution: m.resolution ?? undefined,
        price: m.price ?? undefined,
      })),
      totalPrice: parsed.totalPrice ?? undefined,
      totalQuantity: typeof parsed.totalQuantity === 'number' ? parsed.totalQuantity : monitors.length,
    };
  } catch (error) {
    logger.warn('Failed to parse monitor response:', error);
    return { monitors: [], totalQuantity: 0 };
  }
}

export function parseDesktopResponse(response: string): DesktopData {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in desktop response');
    const parsed = JSON.parse(jsonMatch[0]);
    const desktops = Array.isArray(parsed.desktops) ? parsed.desktops : [];
    return {
      desktops: desktops.map((d: any) => ({
        model: d.model ?? undefined,
        caseType: d.caseType ?? undefined,
        ram: d.ram ?? undefined,
        storage: d.storage ?? undefined,
        price: d.price ?? undefined,
      })),
      totalPrice: parsed.totalPrice ?? undefined,
      totalQuantity: typeof parsed.totalQuantity === 'number' ? parsed.totalQuantity : desktops.length,
    };
  } catch (error) {
    logger.warn('Failed to parse desktop response:', error);
    return { desktops: [], totalQuantity: 0 };
  }
}
