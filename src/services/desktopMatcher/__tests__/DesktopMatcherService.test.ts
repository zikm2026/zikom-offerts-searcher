import { DesktopMatcherService } from '../DesktopMatcherService';
import type { DesktopData } from '../../../types/email';
import prisma from '../../../lib/prisma';

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    watchedDesktop: { findMany: jest.fn() },
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

describe('DesktopMatcherService', () => {
  const service = new DesktopMatcherService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('matchDesktops', () => {
    it('returns empty result when no watched desktops in DB', async () => {
      (prisma.watchedDesktop.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.appSetting.findUnique as jest.Mock).mockResolvedValue({ value: '90' });

      const result = await service.matchDesktops({
        desktops: [
          { caseType: 'Tower', ram: '32 GB', storage: '2 TB', price: '300 EUR' },
        ],
      });

      expect(result.allMatched).toBe(false);
      expect(result.matchedCount).toBe(0);
      expect(result.totalCount).toBe(1);
      expect(result.matches).toHaveLength(0);
      expect(result.shouldNotify).toBe(false);
    });

    it('calls prisma.watchedDesktop.findMany and appSetting.findUnique', async () => {
      (prisma.watchedDesktop.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.appSetting.findUnique as jest.Mock).mockResolvedValue({ value: '90' });

      await service.matchDesktops({ desktops: [] });

      expect(prisma.watchedDesktop.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.appSetting.findUnique).toHaveBeenCalledWith({ where: { key: 'matchThreshold' } });
    });

    it('matches desktop by caseType (case-insensitive), RAM and storage', async () => {
      const watched = {
        id: 'wd1',
        caseType: 'Tower',
        maxPrice: '350',
        ramFrom: '16',
        ramTo: '64',
        storageFrom: '1TB',
        storageTo: '3TB',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.watchedDesktop.findMany as jest.Mock).mockResolvedValue([watched]);
      (prisma.appSetting.findUnique as jest.Mock).mockResolvedValue({ value: '90' });

      const desktopData: DesktopData = {
        desktops: [
          { caseType: 'tower', ram: '32 GB', storage: '2 TB', price: '300 EUR' },
        ],
      };

      const result = await service.matchDesktops(desktopData);

      expect(result.matches).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.matchedCount).toBe(1);
      expect(result.matches[0].watchedDesktop.id).toBe('wd1');
      expect(result.matches[0].actualPrice).toBe(300);
      expect(result.matches[0].isMatch).toBe(true);
      expect(result.allMatched).toBe(true);
      expect(result.shouldNotify).toBe(true);
    });

    it('uses unit price when amount > 1', async () => {
      const watched = {
        id: 'wd1',
        caseType: 'SFF',
        maxPrice: '120',
        ramFrom: '8',
        ramTo: '32',
        storageFrom: '256 GB',
        storageTo: '1 TB',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.watchedDesktop.findMany as jest.Mock).mockResolvedValue([watched]);
      (prisma.appSetting.findUnique as jest.Mock).mockResolvedValue({ value: '90' });

      const result = await service.matchDesktops({
        desktops: [
          { caseType: 'SFF', ram: '16 GB', storage: '512 GB', price: '1000 EUR', amount: 10 },
        ],
      });

      expect(result.matches[0].actualPrice).toBe(100);
      expect(result.matches[0].maxAllowedPrice).toBe(120);
      expect(result.matches[0].isMatch).toBe(true);
      expect(result.matches[0].reason).toContain('100.00');
      expect(result.matches[0].reason).toContain('10 szt.');
    });

    it('normalizes caseType variants (TOWER, Tower, pełna)', async () => {
      const watched = {
        id: 'wd1',
        caseType: 'Tower',
        maxPrice: '500',
        ramFrom: '8',
        ramTo: '64',
        storageFrom: null,
        storageTo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.watchedDesktop.findMany as jest.Mock).mockResolvedValue([watched]);
      (prisma.appSetting.findUnique as jest.Mock).mockResolvedValue({ value: '90' });

      const result = await service.matchDesktops({
        desktops: [
          { caseType: 'TOWER', ram: '32', storage: '1 TB', price: '400 EUR' },
        ],
      });

      expect(result.matches[0].watchedDesktop.id).toBe('wd1');
      expect(result.matches[0].isMatch).toBe(true);
    });

    it('returns not-in-db when caseType does not match', async () => {
      const watched = {
        id: 'wd1',
        caseType: 'SFF',
        maxPrice: '300',
        ramFrom: '16',
        ramTo: '32',
        storageFrom: '1TB',
        storageTo: '2TB',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.watchedDesktop.findMany as jest.Mock).mockResolvedValue([watched]);
      (prisma.appSetting.findUnique as jest.Mock).mockResolvedValue({ value: '90' });

      const result = await service.matchDesktops({
        desktops: [
          { caseType: 'Tower', ram: '16 GB', storage: '1 TB', price: '200 EUR' },
        ],
      });

      expect(result.matches[0].watchedDesktop.id).toBe('');
      expect(result.matches[0].reason).toContain('Nie ma w bazie obserwowanych');
    });

    it('uses quantity-weighted totalCount and matchedCount', async () => {
      const watched = {
        id: 'wd1',
        caseType: 'Tower',
        maxPrice: '250',
        ramFrom: '8',
        ramTo: '64',
        storageFrom: '1TB',
        storageTo: '3TB',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.watchedDesktop.findMany as jest.Mock).mockResolvedValue([watched]);
      (prisma.appSetting.findUnique as jest.Mock).mockResolvedValue({ value: '80' });

      const result = await service.matchDesktops({
        desktops: [
          { caseType: 'Tower', ram: '16 GB', storage: '1 TB', price: '200 EUR', amount: 20 },
          { caseType: 'Mini', ram: '8 GB', storage: '256 GB', price: '150 EUR', amount: 5 },
        ],
      });

      expect(result.totalCount).toBe(25);
      expect(result.matches).toHaveLength(2);
      expect(result.matchedCount).toBe(20);
      expect(result.matches[0].isMatch).toBe(true);
      expect(result.matches[1].watchedDesktop.id).toBe('');
    });
  });
});
