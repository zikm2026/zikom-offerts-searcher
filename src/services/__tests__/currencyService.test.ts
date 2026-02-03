import CurrencyService from '../currencyService';

const mockFetch = jest.fn();

describe('CurrencyService', () => {
  let service: CurrencyService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new CurrencyService();
    (global as any).fetch = mockFetch;
  });

  afterEach(() => {
    delete (global as any).fetch;
  });

  describe('getExchangeRate', () => {
    it('returns 1 for EUR', async () => {
      const rate = await service.getExchangeRate('EUR');
      expect(rate).toBe(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns 1 for €', async () => {
      const rate = await service.getExchangeRate('€');
      expect(rate).toBe(1);
    });

    it('returns 1 for lowercase eur', async () => {
      const rate = await service.getExchangeRate('eur');
      expect(rate).toBe(1);
    });

    it('calls NBP API for USD when not EUR', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rates: [{ mid: 4.0 }],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rates: [{ mid: 4.2 }],
            }),
        });

      const rate = await service.getExchangeRate('USD');
      expect(mockFetch).toHaveBeenCalled();
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThanOrEqual(1.1);
    });

    it('returns null when API fails', async () => {
      mockFetch.mockResolvedValue({ ok: false });
      const rate = await service.getExchangeRate('USD');
      expect(rate).toBeNull();
    });
  });

  describe('convertToEUR', () => {
    it('returns null for NaN or zero amount', async () => {
      expect(await service.convertToEUR(NaN, 'EUR')).toBeNull();
      expect(await service.convertToEUR(0, 'EUR')).toBeNull();
    });

    it('returns same amount for EUR (rate 1)', async () => {
      const result = await service.convertToEUR(100, 'EUR');
      expect(result).toBe(100);
    });

    it('converts when rate is available', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rates: [{ mid: 4.0 }],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rates: [{ mid: 4.2 }],
            }),
        });
      const result = await service.convertToEUR(400, 'USD');
      expect(result).toBeGreaterThan(0);
    });
  });
});
