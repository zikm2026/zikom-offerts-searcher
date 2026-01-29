import logger from '../utils/logger';

interface NBPExchangeRate {
  table: string;
  currency: string;
  code: string;
  rates: Array<{
    no: string;
    effectiveDate: string;
    mid: number;
  }>;
}

class CurrencyService {
  private exchangeRates: Map<string, { rate: number; date: Date }> = new Map();
  private readonly CACHE_TTL = 60 * 60 * 1000;

  async getExchangeRate(currency: string): Promise<number | null> {
    const upperCurrency = currency.toUpperCase();
    
    if (upperCurrency === 'EUR' || upperCurrency === '€') {
      return 1;
    }

    if (upperCurrency === 'PLN' || upperCurrency === 'ZŁ') {
      const eurRate = await this.getEURRate();
      if (!eurRate) return null;
      return 1 / eurRate;
    }

    const cached = this.exchangeRates.get(upperCurrency);
    if (cached && (Date.now() - cached.date.getTime()) < this.CACHE_TTL) {
      logger.debug(`💱 Używam cache kursu ${upperCurrency}: ${cached.rate}`);
      return cached.rate;
    }

    try {
      const nbpCode = upperCurrency === 'USD' ? 'usd' : upperCurrency === 'GBP' ? 'gbp' : null;
      
      if (!nbpCode) {
        logger.warn(`⚠️ Nieobsługiwana waluta: ${upperCurrency}`);
        return null;
      }

      const url = `https://api.nbp.pl/api/exchangerates/rates/a/${nbpCode}/?format=json`;
      logger.debug(`💱 Pobieram kurs ${upperCurrency} z API NBP...`);

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`NBP API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as NBPExchangeRate;
      
      if (!data.rates || data.rates.length === 0) {
        throw new Error('No exchange rate data in NBP response');
      }

      const eurRate = await this.getEURRate();
      if (!eurRate) {
        throw new Error('Could not get EUR rate');
      }

      const currencyRateInPLN = data.rates[0].mid;
      const rateInEUR = currencyRateInPLN / eurRate;

      this.exchangeRates.set(upperCurrency, {
        rate: rateInEUR,
        date: new Date()
      });

      logger.info(`✅ Kurs ${upperCurrency}: ${rateInEUR.toFixed(4)} EUR (z NBP)`);
      return rateInEUR;
    } catch (error) {
      logger.error(`❌ Błąd podczas pobierania kursu ${upperCurrency}:`, error);
      return null;
    }
  }

  private async getEURRate(): Promise<number | null> {
    try {
      const url = 'https://api.nbp.pl/api/exchangerates/rates/a/eur/?format=json';
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`NBP API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as NBPExchangeRate;
      
      if (!data.rates || data.rates.length === 0) {
        throw new Error('No EUR rate data in NBP response');
      }

      return data.rates[0].mid;
    } catch (error) {
      logger.error('❌ Błąd podczas pobierania kursu EUR:', error);
      return null;
    }
  }

  async convertToEUR(amount: number, currency: string): Promise<number | null> {
    if (!amount || isNaN(amount)) {
      return null;
    }

    const rate = await this.getExchangeRate(currency);
    if (rate === null) {
      return null;
    }

    return amount * rate;
  }
}

export default CurrencyService;

