import type { ExcelData, EmailMatchResult } from '../../types/email';
import logger from '../../utils/logger';
import prisma from '../../lib/prisma';
import CurrencyService from '../currencyService';
import { matchLaptop } from './singleLaptopMatcher';
import { logMatchResults } from './matchResultLogger';

const DEFAULT_THRESHOLD = 90;

export class LaptopMatcherService {
  private currencyService: CurrencyService;

  constructor() {
    this.currencyService = new CurrencyService();
  }

  private async getGlobalMatchThreshold(): Promise<number> {
    const row = await prisma.appSetting.findUnique({
      where: { key: 'matchThreshold' },
    });
    if (!row?.value) return DEFAULT_THRESHOLD;
    const n = parseInt(row.value, 10);
    return Number.isNaN(n) ? DEFAULT_THRESHOLD : Math.min(100, Math.max(0, n));
  }

  async matchEmailLaptops(excelData: ExcelData): Promise<EmailMatchResult> {
    try {
      const [watchedLaptops, thresholdPercent] = await Promise.all([
        prisma.watchedLaptop.findMany(),
        this.getGlobalMatchThreshold(),
      ]);

      if (watchedLaptops.length === 0) {
        logger.warn('⚠️  Baza danych laptopów jest pusta!');
        const emptyTotalUnits = excelData.laptops.reduce(
          (sum, l) => sum + (typeof l.amount === 'number' && l.amount > 0 ? l.amount : 1),
          0
        );
        return {
          allLaptopsMatched: false,
          matchedCount: 0,
          totalCount: emptyTotalUnits,
          matches: [],
          shouldNotify: false,
        };
      }

      const matches: EmailMatchResult['matches'] = [];
      let matchedInDbUnits = 0;
      let matchedWithPriceUnits = 0;
      let totalUnits = 0;

      const offerGrade = excelData.grade ?? null;
      for (const laptop of excelData.laptops) {
        const amount = typeof laptop.amount === 'number' && laptop.amount > 0 ? laptop.amount : 1;
        totalUnits += amount;

        try {
          const matchResult = await matchLaptop(
            laptop,
            watchedLaptops,
            this.currencyService,
            offerGrade
          );

          if (matchResult) {
            matches.push(matchResult);
            if (matchResult.watchedLaptop.id) {
              matchedInDbUnits += amount;
            }
            if (matchResult.isMatch) {
              matchedWithPriceUnits += amount;
            }
          }
        } catch (error) {
          logger.error(`Error matching laptop ${laptop.model}:`, error);
        }
      }

      const matchPercentage = totalUnits > 0 ? (matchedInDbUnits / totalUnits) * 100 : 0;
      const priceMatchPercentage = totalUnits > 0 ? (matchedWithPriceUnits / totalUnits) * 100 : 0;

      const allLaptopsMatched = matchPercentage >= thresholdPercent;
      const shouldNotify =
        priceMatchPercentage >= thresholdPercent && matchedWithPriceUnits > 0;

      logger.debug(
        `📊 Dopasowanie: ${matchedInDbUnits}/${totalUnits} szt. w bazie (${matchPercentage.toFixed(1)}%), ${matchedWithPriceUnits}/${totalUnits} szt. spełnia kryteria (${priceMatchPercentage.toFixed(1)}%), próg: ${thresholdPercent}%`
      );

      return {
        allLaptopsMatched,
        matchedCount: matchedWithPriceUnits,
        totalCount: totalUnits,
        matches,
        shouldNotify,
      };
    } catch (error) {
      logger.error('Error matching laptops:', error);
      throw error;
    }
  }

  logMatchResults(emailSubject: string, matchResult: EmailMatchResult): void {
    logMatchResults(emailSubject, matchResult);
  }
}
