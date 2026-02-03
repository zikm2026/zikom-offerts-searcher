import { LaptopSpec } from '../../../types/email';
import logger from '../../../utils/logger';

export function normalizePriceFromGemini(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim().toLowerCase();
  if (s === '' || s === 'null' || s === 'undefined') return undefined;
  return String(value).trim();
}

export function applyTotalPriceFallback(
  laptops: LaptopSpec[],
  totalPrice: string | undefined,
  totalQuantity: number
): void {
  if (!totalPrice || laptops.length === 0) return;
  const count = totalQuantity > 0 ? totalQuantity : laptops.length;
  const withoutPrice = laptops.filter((l) => !normalizePriceFromGemini(l.price));
  if (withoutPrice.length === 0) return;

  const priceUpper = totalPrice.toUpperCase();
  const numStr = totalPrice.replace(/[^\d.,]/g, '').replace(',', '.');
  const totalNum = parseFloat(numStr);
  if (isNaN(totalNum) || totalNum <= 0) return;

  const currency = priceUpper.includes('PLN')
    ? 'PLN'
    : priceUpper.includes('USD')
      ? 'USD'
      : priceUpper.includes('GBP')
        ? 'GBP'
        : 'EUR';
  const perUnit = totalNum / count;
  const priceFormatted = `${perUnit.toFixed(2).replace('.', ',')} ${currency}`;

  laptops.forEach((l) => {
    if (!normalizePriceFromGemini(l.price)) l.price = priceFormatted;
  });

  logger.debug(
    `📊 Uzupełniono cenę z totalPrice: ${totalPrice} → ${priceFormatted} na laptop (${withoutPrice.length} szt.)`
  );
}
