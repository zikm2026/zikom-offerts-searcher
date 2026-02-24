import { matchLaptop } from '../singleLaptopMatcher';
import type { WatchedLaptop } from '@prisma/client';
import CurrencyService from '../../currencyService';

jest.mock('../../currencyService', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getExchangeRate: jest.fn().mockResolvedValue(1),
    convertToEUR: jest.fn((amount: number) => Promise.resolve(amount)),
  })),
}));

const baseWatched: WatchedLaptop = {
  id: 'w1',
  model: 'Dell Latitude 7430',
  maxPriceWorst: '200 EUR',
  maxPriceBest: '600 EUR',
  ramFrom: '8 GB',
  ramTo: '32 GB',
  storageFrom: '256 GB',
  storageTo: '1024 GB',
  gradeFrom: null,
  gradeTo: null,
  graphicsCard: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('singleLaptopMatcher.matchLaptop', () => {
  const currencyService = new (CurrencyService as jest.Mock)();

  beforeEach(() => {
    jest.clearAllMocks();
    (currencyService.convertToEUR as jest.Mock).mockImplementation((n: number) => Promise.resolve(n));
  });

  it('returns not-in-db when no watched laptop matches model', async () => {
    const result = await matchLaptop(
      { model: 'Unknown Model', ram: '16 GB', storage: '512 GB', price: '400 EUR' },
      [baseWatched],
      currencyService
    );
    expect(result).not.toBeNull();
    expect(result!.watchedLaptop.id).toBe('');
    expect(result!.watchedLaptop.model).toBe('(nie w bazie)');
    expect(result!.isMatch).toBe(false);
  });

  it('uses unit price when amount > 1 and matches against max price', async () => {
    const result = await matchLaptop(
      {
        model: 'Dell Latitude 7430',
        ram: '16 GB',
        storage: '512 GB',
        price: '3000 EUR',
        amount: 10,
      },
      [baseWatched],
      currencyService
    );
    expect(result).not.toBeNull();
    expect(result!.actualPrice).toBe(300);
    expect(result!.maxAllowedPrice).toBeGreaterThanOrEqual(200);
    expect(result!.isMatch).toBe(true);
    expect(result!.reason).toContain('cena za szt.');
    expect(result!.reason).toContain('10 szt.');
  });

  it('treats single unit as actualPrice when amount is 1 or missing', async () => {
    const result = await matchLaptop(
      {
        model: 'Dell Latitude 7430',
        ram: '16 GB',
        storage: '512 GB',
        price: '400 EUR',
      },
      [baseWatched],
      currencyService
    );
    expect(result).not.toBeNull();
    expect(result!.actualPrice).toBe(400);
    expect(result!.reason).not.toMatch(/\d+ szt\./);
  });

  it('rejects when unit price exceeds max (amount > 1)', async () => {
    const watched = { ...baseWatched, maxPriceWorst: '100 EUR', maxPriceBest: '150 EUR' };
    const result = await matchLaptop(
      {
        model: 'Dell Latitude 7430',
        ram: '16 GB',
        storage: '512 GB',
        price: '2000 EUR',
        amount: 10,
      },
      [watched],
      currencyService
    );
    expect(result).not.toBeNull();
    expect(result!.actualPrice).toBe(200);
    expect(result!.maxAllowedPrice).toBeLessThan(200);
    expect(result!.isMatch).toBe(false);
    expect(result!.reason).toContain('za drogo');
  });
});
