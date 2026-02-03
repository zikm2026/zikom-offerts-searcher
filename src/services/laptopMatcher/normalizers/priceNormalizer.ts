import logger from '../../../utils/logger';
import CurrencyService from '../../currencyService';

export async function normalizePrice(
  price: string | undefined,
  currencyService: CurrencyService
): Promise<number | null> {
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
    const rate = await currencyService.getExchangeRate(currency);
    if (rate === null) {
      logger.warn(`⚠️ Nie udało się pobrać kursu ${currency}, używam wartości bez przeliczenia`);
      return parsed;
    }
    const converted = await currencyService.convertToEUR(parsed, currency);
    if (converted !== null) {
      logger.debug(`💱 Przeliczono ${parsed} ${currency} → ${converted.toFixed(2)} EUR`);
      return converted;
    }
  }

  return parsed;
}
