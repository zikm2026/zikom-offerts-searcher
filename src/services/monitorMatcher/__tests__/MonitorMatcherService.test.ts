import { MonitorMatcherService } from '../MonitorMatcherService';
import type { MonitorData } from '../../../types/email';
import prisma from '../../../lib/prisma';

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    watchedMonitor: { findMany: jest.fn() },
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

describe('MonitorMatcherService', () => {
  const service = new MonitorMatcherService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('matchMonitors', () => {
    it('returns empty result when no watched monitors in DB', async () => {
      (prisma.watchedMonitor.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.appSetting.findUnique as jest.Mock).mockResolvedValue({ value: '90' });

      const result = await service.matchMonitors({
        monitors: [
          { sizeInches: 24, resolution: '1920x1080', price: '150 EUR' },
        ],
      });

      expect(result.allMatched).toBe(false);
      expect(result.matchedCount).toBe(0);
      expect(result.totalCount).toBe(1);
      expect(result.matches).toHaveLength(0);
      expect(result.shouldNotify).toBe(false);
    });

    it('calls prisma.watchedMonitor.findMany and appSetting.findUnique', async () => {
      (prisma.watchedMonitor.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.appSetting.findUnique as jest.Mock).mockResolvedValue({ value: '90' });

      await service.matchMonitors({ monitors: [] });

      expect(prisma.watchedMonitor.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.appSetting.findUnique).toHaveBeenCalledWith({ where: { key: 'matchThreshold' } });
    });

    it('matches monitor by size and resolution and uses unit price when amount > 1', async () => {
      const watched = {
        id: 'wm1',
        sizeInchesMin: 22,
        sizeInchesMax: 27,
        resolutionMin: '1920x1080',
        resolutionMax: '2560x1440',
        maxPrice: '150',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.watchedMonitor.findMany as jest.Mock).mockResolvedValue([watched]);
      (prisma.appSetting.findUnique as jest.Mock).mockResolvedValue({ value: '90' });

      const monitorData: MonitorData = {
        monitors: [
          { sizeInches: 27, resolution: '1920x1080', price: '3000 EUR', amount: 30 },
        ],
      };

      const result = await service.matchMonitors(monitorData);

      expect(result.matches).toHaveLength(1);
      expect(result.totalCount).toBe(30);
      expect(result.matchedCount).toBe(30);
      expect(result.matches[0].actualPrice).toBe(100);
      expect(result.matches[0].isMatch).toBe(true);
      expect(result.matches[0].reason).toContain('100.00');
      expect(result.matches[0].reason).toContain('30 szt.');
      expect(result.allMatched).toBe(true);
      expect(result.shouldNotify).toBe(true);
    });

    it('rejects when unit price exceeds max price', async () => {
      const watched = {
        id: 'wm1',
        sizeInchesMin: 24,
        sizeInchesMax: 27,
        resolutionMin: '1920x1080',
        resolutionMax: null,
        maxPrice: '80',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.watchedMonitor.findMany as jest.Mock).mockResolvedValue([watched]);
      (prisma.appSetting.findUnique as jest.Mock).mockResolvedValue({ value: '90' });

      const result = await service.matchMonitors({
        monitors: [
          { sizeInches: 24, resolution: '1920x1080', price: '3000 EUR', amount: 30 },
        ],
      });

      expect(result.matches[0].actualPrice).toBe(100);
      expect(result.matches[0].maxAllowedPrice).toBe(80);
      expect(result.matches[0].isMatch).toBe(false);
      expect(result.matchedCount).toBe(0);
    });

    it('uses quantity-weighted totalCount and matchedCount', async () => {
      const watched = {
        id: 'wm1',
        sizeInchesMin: 24,
        sizeInchesMax: 27,
        resolutionMin: '1920x1080',
        resolutionMax: null,
        maxPrice: '200',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.watchedMonitor.findMany as jest.Mock).mockResolvedValue([watched]);
      (prisma.appSetting.findUnique as jest.Mock).mockResolvedValue({ value: '80' });

      const result = await service.matchMonitors({
        monitors: [
          { sizeInches: 24, resolution: '1920x1080', price: '100 EUR', amount: 10 },
          { sizeInches: 30, resolution: '3840x2160', price: '500 EUR', amount: 5 },
        ],
      });

      expect(result.totalCount).toBe(15);
      expect(result.matches).toHaveLength(2);
      expect(result.matches[0].isMatch).toBe(true);
      expect(result.matches[1].watchedMonitor.id).toBe('');
      expect(result.matchedCount).toBe(10);
      expect(result.allMatched).toBe(false);
    });

    it('returns not-in-db when size or resolution does not match any watched', async () => {
      const watched = {
        id: 'wm1',
        sizeInchesMin: 24,
        sizeInchesMax: 27,
        resolutionMin: '1920x1080',
        resolutionMax: null,
        maxPrice: '200',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.watchedMonitor.findMany as jest.Mock).mockResolvedValue([watched]);
      (prisma.appSetting.findUnique as jest.Mock).mockResolvedValue({ value: '90' });

      const result = await service.matchMonitors({
        monitors: [
          { sizeInches: 32, resolution: '3840x2160', price: '400 EUR' },
        ],
      });

      expect(result.matches[0].watchedMonitor.id).toBe('');
      expect(result.matches[0].isMatch).toBe(false);
      expect(result.matches[0].reason).toContain('Nie ma w bazie obserwowanych');
    });
  });
});
