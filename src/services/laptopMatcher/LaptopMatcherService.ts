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
        return {
          allLaptopsMatched: false,
          matchedCount: 0,
          totalCount: excelData.laptops.length,
          matches: [],
          shouldNotify: false,
        };
      }

      const matches: EmailMatchResult['matches'] = [];
      let matchedInDatabase = 0;
      let matchedWithPrice = 0;

      const offerGrade = excelData.grade ?? null;
      for (const laptop of excelData.laptops) {
        try {
          const matchResult = await matchLaptop(
            laptop,
            watchedLaptops,
            this.currencyService,
            offerGrade
          );

          if (matchResult) {
            matches.push(matchResult);
            matchedInDatabase++;

            if (matchResult.isMatch) {
              matchedWithPrice++;
            }
          }
        } catch (error) {
          logger.error(`Error matching laptop ${laptop.model}:`, error);
        }
      }

      const totalCount = excelData.laptops.length;
      const matchPercentage =
        totalCount > 0 ? (matchedInDatabase / totalCount) * 100 : 0;
      const priceMatchPercentage =
        totalCount > 0 ? (matchedWithPrice / totalCount) * 100 : 0;

      const allLaptopsMatched = matchPercentage >= thresholdPercent;
      const shouldNotify =
        priceMatchPercentage >= thresholdPercent && matchedWithPrice > 0;

      logger.debug(
        `📊 Dopasowanie: ${matchedInDatabase}/${totalCount} w bazie (${matchPercentage.toFixed(1)}%), ${matchedWithPrice}/${totalCount} spełnia kryteria (${priceMatchPercentage.toFixed(1)}%), próg: ${thresholdPercent}%`
      );

      return {
        allLaptopsMatched,
        matchedCount: matchedWithPrice,
        totalCount,
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
