import {
  normalizePriceFromGemini,
  applyTotalPriceFallback,
} from '../parsers/priceUtils';

describe('gemini priceUtils', () => {
  describe('normalizePriceFromGemini', () => {
    it('returns undefined for null, undefined, empty, "null"', () => {
      expect(normalizePriceFromGemini(null)).toBeUndefined();
      expect(normalizePriceFromGemini(undefined)).toBeUndefined();
      expect(normalizePriceFromGemini('')).toBeUndefined();
      expect(normalizePriceFromGemini('null')).toBeUndefined();
      expect(normalizePriceFromGemini('undefined')).toBeUndefined();
    });

    it('returns trimmed string for valid value', () => {
      expect(normalizePriceFromGemini('850,00 EUR')).toBe('850,00 EUR');
      expect(normalizePriceFromGemini('  1000 USD  ')).toBe('1000 USD');
    });
  });

  describe('applyTotalPriceFallback', () => {
    it('does nothing when totalPrice empty or laptops empty', () => {
      const laptops = [{ model: 'X', price: undefined }];
      applyTotalPriceFallback(laptops, undefined, 1);
      expect(laptops[0].price).toBeUndefined();
      applyTotalPriceFallback([], '1000 EUR', 1);
    });

    it('fills missing prices with totalPrice / totalQuantity', () => {
      const laptops = [
        { model: 'A', price: undefined },
        { model: 'B', price: '500 EUR' },
        { model: 'C', price: undefined },
      ];
      applyTotalPriceFallback(laptops, '1500,00 EUR', 3);
      expect(laptops[0].price).toBe('500,00 EUR');
      expect(laptops[1].price).toBe('500 EUR');
      expect(laptops[2].price).toBe('500,00 EUR');
    });

    it('detects currency from totalPrice string', () => {
      const laptops = [{ model: 'A', price: undefined }];
      applyTotalPriceFallback(laptops, '1000 PLN', 1);
      expect(laptops[0].price).toContain('PLN');
    });
  });
});
