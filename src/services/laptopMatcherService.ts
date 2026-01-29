import { WatchedLaptop } from '@prisma/client';
import { LaptopSpec, ExcelData, EmailMatchResult, MatchResult } from '../types/email';
import logger from '../utils/logger';
import prisma from '../lib/prisma';
import CurrencyService from './currencyService';

class LaptopMatcherService {
  private currencyService: CurrencyService;

  constructor() {
    this.currencyService = new CurrencyService();
  }

  private normalizeToGB(value: string | undefined): number | null {
    if (!value) return null;
    
    const cleanValue = value.toUpperCase().trim();
    const match = cleanValue.match(/(\d+(?:[.,]\d+)?)\s*(TB|GB|MB)?/);
    
    if (!match) return null;
    
    const num = parseFloat(match[1].replace(',', '.'));
    const unit = match[2] || 'GB';
    
    if (unit === 'TB') return num * 1024;
    if (unit === 'GB') return num;
    if (unit === 'MB') return num / 1024;
    
    return num;
  }

  private async normalizePrice(price: string | undefined): Promise<number | null> {
    if (!price) return null;

    const priceUpper = price.toUpperCase().trim();
    let currency = 'EUR';
    
    if (priceUpper.includes('USD') || priceUpper.includes('$')) {
      currency = 'USD';
    } else if (priceUpper.includes('GBP') || priceUpper.includes('£')) {
      currency = 'GBP';
    } else if (priceUpper.includes('EUR') || priceUpper.includes('€')) {
      currency = 'EUR';
    } else if (priceUpper.includes('PLN') || priceUpper.includes('ZŁ')) {
      currency = 'PLN';
    }
    
    const cleaned = price.replace(/[^\d.,]/g, '');
    const normalized = cleaned.replace(',', '.');
    const parsed = parseFloat(normalized);
    
    if (isNaN(parsed)) return null;
    
    if (currency !== 'EUR') {
      const rate = await this.currencyService.getExchangeRate(currency);
      if (rate === null) {
        logger.warn(`⚠️ Nie udało się pobrać kursu ${currency}, używam wartości bez przeliczenia`);
        return parsed;
      }
      const converted = await this.currencyService.convertToEUR(parsed, currency);
      if (converted !== null) {
        logger.debug(`💱 Przeliczono ${parsed} ${currency} → ${converted.toFixed(2)} EUR`);
        return converted;
      }
    }
    
    return parsed;
  }

  private isModelMatch(laptopModel: string | undefined, watchedModel: string): boolean {
    if (!laptopModel) return false;
    
    const laptop = laptopModel.toLowerCase().trim();
    const watched = watchedModel.toLowerCase().trim();
    
    if (laptop === watched) return true;
    
    if (laptop.includes(watched)) return true;
    
    if (watched.includes(laptop)) return true;
    
    const watchedWords = watched.split(/\s+/);
    const laptopWords = laptop.split(/\s+/);
    
    const allWordsMatch = watchedWords.every(word => 
      laptopWords.some(lw => lw.includes(word) || word.includes(lw))
    );
    
    return allWordsMatch;
  }

  private isGraphicsCardMatch(
    laptopGraphicsCard: string | undefined,
    watchedGraphicsCard: string | null | undefined
  ): boolean {
    if (!watchedGraphicsCard || watchedGraphicsCard.trim() === '') {
      return true;
    }
    
    if (!laptopGraphicsCard || laptopGraphicsCard.trim() === '') {
      return false;
    }
    
    const laptop = laptopGraphicsCard.toLowerCase().trim();
    const watched = watchedGraphicsCard.toLowerCase().trim();
    
    if (laptop === watched) return true;
    
    if (laptop.includes(watched)) return true;
    
    if (watched.includes(laptop)) return true;
    
    const watchedWords = watched.split(/\s+/).filter(w => w.length > 2);
    const allWordsMatch = watchedWords.every(word => 
      laptop.includes(word)
    );
    
    return allWordsMatch;
  }

  private async calculateMaxAllowedPrice(
    laptop: LaptopSpec,
    watchedLaptop: WatchedLaptop
  ): Promise<{ maxPrice: number; reason: string }> {
    const priceWorst = await this.normalizePrice(watchedLaptop.maxPriceWorst || '0');
    const priceBest = await this.normalizePrice(watchedLaptop.maxPriceBest || '0');
    
    if (priceWorst === null || priceBest === null) {
      return {
        maxPrice: 0,
        reason: 'Brak zdefiniowanych cen w bazie danych'
      };
    }

    const laptopRam = this.normalizeToGB(laptop.ram);
    const laptopStorage = this.normalizeToGB(laptop.storage);
    
    const ramFromDB = this.normalizeToGB(watchedLaptop.ramFrom || '0');
    const ramToDB = this.normalizeToGB(watchedLaptop.ramTo || '999999');
    const storageFromDB = this.normalizeToGB(watchedLaptop.storageFrom || '0');
    const storageToDB = this.normalizeToGB(watchedLaptop.storageTo || '999999');
    
    if (laptopRam === null || laptopStorage === null) {
      return {
        maxPrice: 0,
        reason: 'Brak informacji o RAM lub dysku w ofercie'
      };
    }

    if (ramFromDB !== null && laptopRam < ramFromDB) {
      return {
        maxPrice: 0,
        reason: `RAM ${laptop.ram} poniżej minimalnego (${watchedLaptop.ramFrom})`
      };
    }
    
    if (ramToDB !== null && laptopRam > ramToDB) {
      return {
        maxPrice: 0,
        reason: `RAM ${laptop.ram} powyżej maksymalnego (${watchedLaptop.ramTo})`
      };
    }
    
    if (storageFromDB !== null && laptopStorage < storageFromDB) {
      return {
        maxPrice: 0,
        reason: `Dysk ${laptop.storage} poniżej minimalnego (${watchedLaptop.storageFrom})`
      };
    }
    
    if (storageToDB !== null && laptopStorage > storageToDB) {
      return {
        maxPrice: 0,
        reason: `Dysk ${laptop.storage} powyżej maksymalnego (${watchedLaptop.storageTo})`
      };
    }
    
    const watchedGraphicsCard = (watchedLaptop as any).graphicsCard || null;
    if (!this.isGraphicsCardMatch(laptop.graphicsCard, watchedGraphicsCard)) {
      return {
        maxPrice: 0,
        reason: `Karta graficzna "${laptop.graphicsCard || 'brak'}" nie pasuje do wymaganej "${watchedGraphicsCard}"`
      };
    }

    const ramRange = (ramToDB || 0) - (ramFromDB || 0);
    const storageRange = (storageToDB || 0) - (storageFromDB || 0);
    
    const ramFactor = ramRange > 0 
      ? ((laptopRam || 0) - (ramFromDB || 0)) / ramRange 
      : 0.5;
      
    const storageFactor = storageRange > 0 
      ? ((laptopStorage || 0) - (storageFromDB || 0)) / storageRange 
      : 0.5;
    
    const avgFactor = (ramFactor + storageFactor) / 2;
    
    const maxPrice = priceWorst + (priceBest - priceWorst) * avgFactor;
    
    const reason = `RAM: ${laptop.ram} (${(ramFactor * 100).toFixed(0)}%), ` +
                   `Dysk: ${laptop.storage} (${(storageFactor * 100).toFixed(0)}%), ` +
                   `Średnia: ${(avgFactor * 100).toFixed(0)}%`;
    
    return { maxPrice: Math.round(maxPrice), reason };
  }

  private async matchLaptop(
    laptop: LaptopSpec,
    watchedLaptops: WatchedLaptop[]
  ): Promise<MatchResult | null> {
    const watchedLaptop = watchedLaptops.find(wl => 
      this.isModelMatch(laptop.model, wl.model)
    );
    
    if (!watchedLaptop) {
      return null;
    }

    const { maxPrice, reason } = await this.calculateMaxAllowedPrice(laptop, watchedLaptop);
    
    if (maxPrice === 0) {
      return {
        laptop,
        watchedLaptop,
        maxAllowedPrice: 0,
        actualPrice: 0,
        isMatch: false,
        reason
      };
    }

    const actualPrice = await this.normalizePrice(laptop.price);
    
    if (actualPrice === null) {
      return {
        laptop,
        watchedLaptop,
        maxAllowedPrice: maxPrice,
        actualPrice: 0,
        isMatch: false,
        reason: 'Brak ceny w ofercie'
      };
    }

    const isMatch = actualPrice <= maxPrice;
    
    return {
      laptop,
      watchedLaptop: {
        id: watchedLaptop.id,
        model: watchedLaptop.model,
        maxPriceWorst: watchedLaptop.maxPriceWorst,
        maxPriceBest: watchedLaptop.maxPriceBest,
        ramFrom: watchedLaptop.ramFrom,
        ramTo: watchedLaptop.ramTo,
        storageFrom: watchedLaptop.storageFrom,
        storageTo: watchedLaptop.storageTo,
        gradeFrom: watchedLaptop.gradeFrom,
        gradeTo: watchedLaptop.gradeTo,
        graphicsCard: (watchedLaptop as any).graphicsCard || null,
      },
      maxAllowedPrice: maxPrice,
      actualPrice,
      isMatch,
      reason: isMatch 
        ? `✅ ${reason} → max ${maxPrice.toFixed(2).replace('.', ',')} €, cena: ${actualPrice.toFixed(2).replace('.', ',')} €`
        : `❌ ${reason} → max ${maxPrice.toFixed(2).replace('.', ',')} €, cena: ${actualPrice.toFixed(2).replace('.', ',')} € (za drogo!)`
    };
  }

  async matchEmailLaptops(excelData: ExcelData): Promise<EmailMatchResult> {
    try {
      const watchedLaptops = await prisma.watchedLaptop.findMany();
      
      if (watchedLaptops.length === 0) {
        logger.warn('⚠️  Baza danych laptopów jest pusta!');
        return {
          allLaptopsMatched: false,
          matchedCount: 0,
          totalCount: excelData.laptops.length,
          matches: [],
          shouldNotify: false
        };
      }

      const matches: MatchResult[] = [];
      let matchedInDatabase = 0;
      let matchedWithPrice = 0;

      const maxThreshold = Math.max(...watchedLaptops.map(l => l.matchThreshold || 90));
      const threshold = maxThreshold / 100;

      for (const laptop of excelData.laptops) {
        try {
          const matchResult = await this.matchLaptop(laptop, watchedLaptops);
          
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

      const matchPercentage = excelData.laptops.length > 0 
        ? (matchedInDatabase / excelData.laptops.length) * 100 
        : 0;
      
      const priceMatchPercentage = excelData.laptops.length > 0
        ? (matchedWithPrice / excelData.laptops.length) * 100
        : 0;
      
      const allLaptopsMatched = matchPercentage >= (threshold * 100);
      const shouldNotify = priceMatchPercentage >= (threshold * 100) && matchedWithPrice > 0;
      
      logger.debug(`📊 Dopasowanie: ${matchedInDatabase}/${excelData.laptops.length} w bazie (${matchPercentage.toFixed(1)}%), ${matchedWithPrice}/${excelData.laptops.length} spełnia kryteria (${priceMatchPercentage.toFixed(1)}%), próg: ${maxThreshold}%`);

      return {
        allLaptopsMatched,
        matchedCount: matchedWithPrice,
        totalCount: excelData.laptops.length,
        matches,
        shouldNotify
      };
    } catch (error) {
      logger.error('Error matching laptops:', error);
      throw error;
    }
  }

  logMatchResults(emailSubject: string, matchResult: EmailMatchResult): void {
    logger.info('\n' + '='.repeat(80));
    logger.info(`📧 EMAIL: ${emailSubject}`);
    logger.info('='.repeat(80));
    
    if (matchResult.shouldNotify) {
      logger.info('🎯 ✅ EMAIL INTERESUJĄCY - WYSTARCZAJĄCO LAPTOPÓW SPEŁNIA KRYTERIA!');
    } else if (matchResult.allLaptopsMatched && matchResult.matchedCount > 0) {
      logger.info(`⚠️  WSZYSTKIE LAPTOPY W BAZIE, ALE TYLKO ${matchResult.matchedCount}/${matchResult.totalCount} SPEŁNIA KRYTERIA CENOWE (poniżej progu 90%)`);
    } else if (matchResult.allLaptopsMatched) {
      logger.info('⚠️  WSZYSTKIE LAPTOPY W BAZIE, ALE ŻADEN NIE SPEŁNIA KRYTERIÓW CENOWYCH');
    } else {
      logger.info(`❌ EMAIL POMINIĘTY - Tylko ${matchResult.matches.length}/${matchResult.totalCount} laptopów w bazie`);
    }
    
    logger.info(`📊 Statystyki: ${matchResult.matchedCount} spełnia kryteria / ${matchResult.totalCount} w ofercie`);
    logger.info('-'.repeat(80));
    
    if (matchResult.matches.length > 0) {
      logger.info('💻 SZCZEGÓŁY LAPTOPÓW:');
      matchResult.matches.forEach((match, index) => {
        logger.info(`\n   ${index + 1}. ${match.laptop.model || 'Unknown Model'}`);
        logger.info(`      ${match.reason}`);
      });
    }
    
    logger.info('='.repeat(80) + '\n');
  }
}

export default LaptopMatcherService;

