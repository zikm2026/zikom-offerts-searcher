import { calculateMaxAllowedPrice } from '../calculators/maxPriceCalculator';
import CurrencyService from '../../currencyService';

const mockCurrencyService = {
  getExchangeRate: jest.fn(),
  convertToEUR: jest.fn(),
} as unknown as CurrencyService;

describe('maxPriceCalculator.calculateMaxAllowedPrice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockCurrencyService.getExchangeRate as jest.Mock).mockResolvedValue(1);
    (mockCurrencyService.convertToEUR as jest.Mock).mockImplementation(
      (amount: number) => Promise.resolve(amount)
    );
  });

  const baseWatched = {
    id: 'id-1',
    model: 'Dell Latitude 7430',
    maxPriceWorst: '200 EUR',
    maxPriceBest: '500 EUR',
    ramFrom: '8 GB',
    ramTo: '32 GB',
    storageFrom: '256 GB',
    storageTo: '1 TB',
    gradeFrom: null,
    gradeTo: null,
    graphicsCard: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('returns maxPrice 0 when price does not parse (invalid string)', async () => {
    const watched = { ...baseWatched, maxPriceWorst: 'invalid', maxPriceBest: '500 EUR' };
    (mockCurrencyService.convertToEUR as jest.Mock).mockResolvedValue(null);
    (mockCurrencyService.getExchangeRate as jest.Mock).mockResolvedValue(null);

    const result = await calculateMaxAllowedPrice(
      { model: 'Dell Latitude 7430', ram: '16 GB', storage: '512 GB' },
      watched as any,
      mockCurrencyService
    );

    expect(result.maxPrice).toBe(0);
    expect(result.reason).toContain('Brak zdefiniowanych cen');
  });

  it('returns maxPrice 0 when laptop has no RAM or storage', async () => {
    (mockCurrencyService.convertToEUR as jest.Mock).mockResolvedValue(200);
    const result = await calculateMaxAllowedPrice(
      { model: 'Dell Latitude 7430', ram: undefined, storage: '512 GB' },
      baseWatched as any,
      mockCurrencyService
    );
    expect(result.maxPrice).toBe(0);
    expect(result.reason).toContain('Brak informacji o RAM lub dysku');
  });

  it('returns maxPrice 0 when RAM below minimum', async () => {
    (mockCurrencyService.convertToEUR as jest.Mock).mockResolvedValue(200);
    const result = await calculateMaxAllowedPrice(
      { model: 'Dell Latitude 7430', ram: '4 GB', storage: '512 GB' },
      baseWatched as any,
      mockCurrencyService
    );
    expect(result.maxPrice).toBe(0);
    expect(result.reason).toContain('RAM');
    expect(result.reason).toContain('poniżej minimalnego');
  });

  it('returns maxPrice 0 when graphics card does not match', async () => {
    (mockCurrencyService.convertToEUR as jest.Mock).mockResolvedValue(200);
    const watched = { ...baseWatched, graphicsCard: 'NVIDIA RTX 3060' };
    const result = await calculateMaxAllowedPrice(
      { model: 'Dell Latitude 7430', ram: '16 GB', storage: '512 GB', graphicsCard: 'Intel UHD' },
      watched as any,
      mockCurrencyService
    );
    expect(result.maxPrice).toBe(0);
    expect(result.reason).toContain('Karta graficzna');
  });

  it('calculates max price in range when specs in range', async () => {
    (mockCurrencyService.convertToEUR as jest.Mock)
      .mockResolvedValueOnce(200)
      .mockResolvedValueOnce(500);

    const result = await calculateMaxAllowedPrice(
      { model: 'Dell Latitude 7430', ram: '16 GB', storage: '512 GB' },
      baseWatched as any,
      mockCurrencyService
    );

    expect(result.maxPrice).toBeGreaterThan(0);
    expect(result.maxPrice).toBeLessThanOrEqual(500);
    expect(result.reason).toContain('RAM');
    expect(result.reason).toContain('Dysk');
  });
});
