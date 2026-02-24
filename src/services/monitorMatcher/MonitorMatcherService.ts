import type { MonitorData, MonitorEmailMatchResult, MonitorMatchResult, MonitorSpec } from '../../types/email';
import logger from '../../utils/logger';
import prisma from '../../lib/prisma';
import CurrencyService from '../currencyService';
import { normalizePrice } from '../laptopMatcher/normalizers/priceNormalizer';

const DEFAULT_THRESHOLD = 90;

function parseSizeInches(val: MonitorSpec['sizeInches']): number | null {
  if (val == null) return null;
  if (typeof val === 'number') return Number.isNaN(val) ? null : val;
  const s = String(val).replace(/["''\s]/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function parseResolution(s: string | undefined): { w: number; h: number } | null {
  if (!s || typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d+)\s*[x×]\s*(\d+)$/i) || s.trim().match(/^(\d+)\s*[*]\s*(\d+)$/);
  if (!m) return null;
  const w = parseInt(m[1], 10);
  const h = parseInt(m[2], 10);
  return Number.isNaN(w) || Number.isNaN(h) ? null : { w, h };
}

function resolutionInRange(offerRes: { w: number; h: number } | null, minRes: string | null, maxRes: string | null): boolean {
  if (!offerRes) return false;
  const min = parseResolution(minRes || '');
  const max = parseResolution(maxRes || '');
  const pixels = offerRes.w * offerRes.h;
  if (min) {
    const minP = min.w * min.h;
    if (pixels < minP) return false;
  }
  if (max) {
    const maxP = max.w * max.h;
    if (pixels > maxP) return false;
  }
  return true;
}

function sizeInRange(offerSize: number | null, minInches: number | null, maxInches: number | null): boolean {
  if (offerSize == null) return false;
  if (minInches != null && offerSize < minInches) return false;
  if (maxInches != null && offerSize > maxInches) return false;
  return true;
}

const NOT_IN_DB_PLACEHOLDER = {
  id: '',
  sizeInchesMin: null as number | null,
  sizeInchesMax: null as number | null,
  resolutionMin: null as string | null,
  resolutionMax: null as string | null,
  maxPrice: null as string | null,
};

export class MonitorMatcherService {
  private currencyService: CurrencyService;

  constructor() {
    this.currencyService = new CurrencyService();
  }

  private async getGlobalMatchThreshold(): Promise<number> {
    const row = await prisma.appSetting.findUnique({ where: { key: 'matchThreshold' } });
    if (!row?.value) return DEFAULT_THRESHOLD;
    const n = parseInt(row.value, 10);
    return Number.isNaN(n) ? DEFAULT_THRESHOLD : Math.min(100, Math.max(0, n));
  }

  async matchMonitors(monitorData: MonitorData): Promise<MonitorEmailMatchResult> {
    try {
      const [watchedMonitors, thresholdPercent] = await Promise.all([
        prisma.watchedMonitor.findMany(),
        this.getGlobalMatchThreshold(),
      ]);

      if (watchedMonitors.length === 0) {
        logger.warn('⚠️  Baza obserwowanych monitorów jest pusta!');
        return {
          allMatched: false,
          matchedCount: 0,
          totalCount: monitorData.monitors.length,
          matches: [],
          shouldNotify: false,
        };
      }

      const matches: MonitorMatchResult[] = [];
      let matchedInDb = 0;
      let matchedWithPrice = 0;

      for (const monitor of monitorData.monitors) {
        const offerSize = parseSizeInches(monitor.sizeInches);
        const offerRes = parseResolution(monitor.resolution);

        const watched = watchedMonitors.find((w) => {
          if (!sizeInRange(offerSize, w.sizeInchesMin ?? null, w.sizeInchesMax ?? null)) return false;
          if (!resolutionInRange(offerRes, w.resolutionMin, w.resolutionMax)) return false;
          return true;
        });

        if (!watched) {
          matches.push({
            monitor,
            watchedMonitor: NOT_IN_DB_PLACEHOLDER,
            maxAllowedPrice: 0,
            actualPrice: 0,
            isMatch: false,
            reason: 'Nie ma w bazie obserwowanych (wielkość/rozdzielczość)',
          });
          continue;
        }

        matchedInDb++;
        const maxPriceNum = watched.maxPrice ? parseFloat(watched.maxPrice.replace(',', '.')) : 0;
        const maxAllowedPrice = Number.isNaN(maxPriceNum) ? 0 : maxPriceNum;
        const totalPrice = await normalizePrice(monitor.price, this.currencyService);
        const total = totalPrice ?? 0;
        const amount = typeof monitor.amount === 'number' && monitor.amount > 0 ? monitor.amount : 1;
        const actualPrice = amount > 1 ? total / amount : total;
        const isMatch = maxAllowedPrice > 0 && actualPrice > 0 && actualPrice <= maxAllowedPrice;
        const reason = isMatch
          ? `✅ Dopasowano – max ${maxAllowedPrice.toFixed(2)} €, cena za szt.: ${actualPrice.toFixed(2)} €${amount > 1 ? ` (${total.toFixed(2)} € za ${amount} szt.)` : ''}`
          : actualPrice > maxAllowedPrice
            ? `❌ Za drogo – max ${maxAllowedPrice.toFixed(2)} €, cena za szt.: ${actualPrice.toFixed(2)} €${amount > 1 ? ` (${total.toFixed(2)} € za ${amount} szt.)` : ''}`
            : 'Brak ceny w ofercie';

        matches.push({
          monitor,
          watchedMonitor: {
            id: watched.id,
            sizeInchesMin: watched.sizeInchesMin,
            sizeInchesMax: watched.sizeInchesMax,
            resolutionMin: watched.resolutionMin,
            resolutionMax: watched.resolutionMax,
            maxPrice: watched.maxPrice,
          },
          maxAllowedPrice,
          actualPrice: actualPrice,
          isMatch,
          reason,
        });
        if (isMatch) matchedWithPrice++;
      }

      const totalCount = monitorData.monitors.length;
      const matchPct = totalCount > 0 ? (matchedInDb / totalCount) * 100 : 0;
      const pricePct = totalCount > 0 ? (matchedWithPrice / totalCount) * 100 : 0;
      const allMatched = matchPct >= thresholdPercent;
      const shouldNotify = pricePct >= thresholdPercent && matchedWithPrice > 0;

      logger.debug(
        `📊 Monitory: ${matchedInDb}/${totalCount} w bazie (${matchPct.toFixed(1)}%), ${matchedWithPrice}/${totalCount} spełnia kryteria (${pricePct.toFixed(1)}%), próg: ${thresholdPercent}%`
      );

      return { allMatched, matchedCount: matchedWithPrice, totalCount, matches, shouldNotify };
    } catch (error) {
      logger.error('Error matching monitors:', error);
      throw error;
    }
  }
}
