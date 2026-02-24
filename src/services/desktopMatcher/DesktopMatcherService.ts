import type { DesktopData, DesktopEmailMatchResult, DesktopMatchResult } from '../../types/email';
import logger from '../../utils/logger';
import prisma from '../../lib/prisma';
import { normalizePrice } from '../laptopMatcher/normalizers/priceNormalizer';
import CurrencyService from '../currencyService';

const DEFAULT_THRESHOLD = 90;

function normalizeCaseType(s: string | undefined): string | null {
  if (!s || typeof s !== 'string') return null;
  const t = s.trim().toUpperCase();
  if (/TOWER|FULL|PELNA|STANDARD/i.test(t)) return 'Tower';
  if (/SFF|SMALL|MALA|MFF|USFF/i.test(t)) return 'SFF';
  if (/MINI|MICRO|COMPACT/i.test(t)) return 'Mini';
  return null;
}

function parseRam(s: string | undefined): number | null {
  if (!s) return null;
  const str = String(s).trim();
  const m = str.match(/(\d+)\s*GB/i);
  if (m) return parseInt(m[1], 10);
  const numOnly = str.match(/^(\d+)$/);
  if (numOnly) return parseInt(numOnly[1], 10);
  const beforeRam = str.match(/(\d+)\s*RAM/i);
  return beforeRam ? parseInt(beforeRam[1], 10) : null;
}

function ramInRange(offerRam: number | null, from: string | null, to: string | null): boolean {
  if (offerRam == null) return true;
  const fromN = from ? parseRam(from) : null;
  const toN = to ? parseRam(to) : null;
  if (fromN != null && offerRam < fromN) return false;
  if (toN != null && offerRam > toN) return false;
  return true;
}

function parseStorage(s: string | undefined): number | null {
  if (!s) return null;
  const str = String(s).toUpperCase();
  let gb = 0;
  const tbMatch = str.match(/(\d+)\s*TB/);
  const gbMatch = str.match(/(\d+)\s*GB/);
  if (tbMatch) gb += parseInt(tbMatch[1], 10) * 1024;
  if (gbMatch) gb += parseInt(gbMatch[1], 10);
  return gb > 0 ? gb : null;
}

function storageInRange(offerGb: number | null, from: string | null, to: string | null): boolean {
  if (offerGb == null) return true;
  const fromN = from ? parseStorage(from) : null;
  const toN = to ? parseStorage(to) : null;
  if (fromN != null && offerGb < fromN) return false;
  if (toN != null && offerGb > toN) return false;
  return true;
}

const NOT_IN_DB_PLACEHOLDER = {
  id: '',
  caseType: '',
  maxPrice: null as string | null,
  ramFrom: null as string | null,
  ramTo: null as string | null,
  storageFrom: null as string | null,
  storageTo: null as string | null,
};

export class DesktopMatcherService {
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

  async matchDesktops(desktopData: DesktopData): Promise<DesktopEmailMatchResult> {
    try {
      const [watchedDesktops, thresholdPercent] = await Promise.all([
        prisma.watchedDesktop.findMany(),
        this.getGlobalMatchThreshold(),
      ]);

      if (watchedDesktops.length === 0) {
        logger.warn('⚠️  Baza obserwowanych komputerów stacjonarnych jest pusta!');
        return {
          allMatched: false,
          matchedCount: 0,
          totalCount: desktopData.desktops.length,
          matches: [],
          shouldNotify: false,
        };
      }

      const matches: DesktopMatchResult[] = [];
      let matchedInDb = 0;
      let matchedWithPrice = 0;

      for (const desktop of desktopData.desktops) {
        const offerCaseType = normalizeCaseType(desktop.caseType);
        const offerRam = parseRam(desktop.ram);
        const offerStorage = parseStorage(desktop.storage);

        const watched = watchedDesktops.find((w) => {
          const wCase = w.caseType.toUpperCase();
          const offerCaseUpper = offerCaseType?.toUpperCase() ?? '';
          if (offerCaseUpper && wCase !== offerCaseUpper) return false;
          if (!ramInRange(offerRam, w.ramFrom, w.ramTo)) return false;
          if (!storageInRange(offerStorage, w.storageFrom, w.storageTo)) return false;
          return true;
        });

        if (!watched) {
          matches.push({
            desktop,
            watchedDesktop: NOT_IN_DB_PLACEHOLDER,
            maxAllowedPrice: 0,
            actualPrice: 0,
            isMatch: false,
            reason: 'Nie ma w bazie obserwowanych (typ obudowy/RAM/dysk)',
          });
          continue;
        }

        matchedInDb++;
        const maxPriceNum = watched.maxPrice ? parseFloat(watched.maxPrice.replace(',', '.')) : 0;
        const maxAllowedPrice = Number.isNaN(maxPriceNum) ? 0 : maxPriceNum;
        const totalPrice = await normalizePrice(desktop.price, this.currencyService);
        const total = totalPrice ?? 0;
        const amount = typeof desktop.amount === 'number' && desktop.amount > 0 ? desktop.amount : 1;
        const actualPrice = amount > 1 ? total / amount : total;
        const isMatch = maxAllowedPrice > 0 && actualPrice > 0 && actualPrice <= maxAllowedPrice;
        const reason = isMatch
          ? `✅ Dopasowano – max ${maxAllowedPrice.toFixed(2)} €, cena za szt.: ${actualPrice.toFixed(2)} €${amount > 1 ? ` (${total.toFixed(2)} € za ${amount} szt.)` : ''}`
          : actualPrice > maxAllowedPrice
            ? `❌ Za drogo – max ${maxAllowedPrice.toFixed(2)} €, cena za szt.: ${actualPrice.toFixed(2)} €${amount > 1 ? ` (${total.toFixed(2)} € za ${amount} szt.)` : ''}`
            : 'Brak ceny w ofercie';

        matches.push({
          desktop,
          watchedDesktop: {
            id: watched.id,
            caseType: watched.caseType,
            maxPrice: watched.maxPrice,
            ramFrom: watched.ramFrom,
            ramTo: watched.ramTo,
            storageFrom: watched.storageFrom,
            storageTo: watched.storageTo,
          },
          maxAllowedPrice,
          actualPrice: actualPrice,
          isMatch,
          reason,
        });
        if (isMatch) matchedWithPrice++;
      }

      const totalCount = desktopData.desktops.length;
      const matchPct = totalCount > 0 ? (matchedInDb / totalCount) * 100 : 0;
      const pricePct = totalCount > 0 ? (matchedWithPrice / totalCount) * 100 : 0;
      const allMatched = matchPct >= thresholdPercent;
      const shouldNotify = pricePct >= thresholdPercent && matchedWithPrice > 0;

      logger.debug(
        `📊 Komputery stacjonarne: ${matchedInDb}/${totalCount} w bazie (${matchPct.toFixed(1)}%), ${matchedWithPrice}/${totalCount} spełnia kryteria (${pricePct.toFixed(1)}%), próg: ${thresholdPercent}%`
      );

      return { allMatched, matchedCount: matchedWithPrice, totalCount, matches, shouldNotify };
    } catch (error) {
      logger.error('Error matching desktops:', error);
      throw error;
    }
  }
}
