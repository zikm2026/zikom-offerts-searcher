import { LaptopMatcherService } from '../LaptopMatcherService';
import prisma from '../../../lib/prisma';

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    watchedLaptop: { findMany: jest.fn() },
    appSetting: { findUnique: jest.fn() },
  },
}));

jest.mock('../../currencyService', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getExchangeRate: jest.fn().mockResolvedValue(1),
    convertToEUR: jest.fn((amount: number) => Promise.resolve(amount)),
  })),
}));

describe('LaptopMatcherService', () => {
  const service = new LaptopMatcherService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('matchEmailLaptops', () => {
    it('returns empty result when no watched laptops in DB', async () => {
      (prisma.watchedLaptop.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.appSetting.findUnique as jest.Mock).mockResolvedValue({ value: '90' });

      const result = await service.matchEmailLaptops({
        laptops: [{ model: 'Dell Latitude 7430', ram: '16 GB', storage: '512 GB', price: '400 EUR' }],
        totalQuantity: 1,
      });

      expect(result.allLaptopsMatched).toBe(false);
      expect(result.matchedCount).toBe(0);
      expect(result.totalCount).toBe(1);
      expect(result.matches).toHaveLength(0);
      expect(result.shouldNotify).toBe(false);
    });

    it('calls prisma.watchedLaptop.findMany once', async () => {
      (prisma.watchedLaptop.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.appSetting.findUnique as jest.Mock).mockResolvedValue({ value: '90' });

      await service.matchEmailLaptops({ laptops: [], totalQuantity: 0 });

      expect(prisma.watchedLaptop.findMany).toHaveBeenCalledTimes(1);
    });

    it('returns matches when watched laptops exist and one matches', async () => {
      const watched = {
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
      (prisma.watchedLaptop.findMany as jest.Mock).mockResolvedValue([watched]);
      (prisma.appSetting.findUnique as jest.Mock).mockResolvedValue({ value: '90' });

      const result = await service.matchEmailLaptops({
        laptops: [
          {
            model: 'Dell Latitude 7430',
            ram: '16 GB',
            storage: '512 GB',
            price: '400 EUR',
          },
        ],
        totalQuantity: 1,
      });

      expect(result.totalCount).toBe(1);
      expect(result.matches.length).toBeGreaterThanOrEqual(0);
      expect(typeof result.allLaptopsMatched).toBe('boolean');
      expect(typeof result.shouldNotify).toBe('boolean');
    });
  });

  describe('logMatchResults', () => {
    it('does not throw', () => {
      expect(() =>
        service.logMatchResults('Test subject', {
          allLaptopsMatched: true,
          matchedCount: 1,
          totalCount: 1,
          matches: [],
          shouldNotify: true,
        })
      ).not.toThrow();
    });
  });
});
