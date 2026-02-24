import EmailStatsService from '../emailStatsService';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    emailStat: {
      create: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe('EmailStatsService', () => {
  const service = new EmailStatsService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordEmailStat', () => {
    it('calls prisma.emailStat.create with data', async () => {
      (prisma.emailStat.create as jest.Mock).mockResolvedValue({});

      await service.recordEmailStat({
        status: 'processed',
        subject: 'Test subject',
        from: 'test@test.com',
      });

      expect(prisma.emailStat.create).toHaveBeenCalledTimes(1);
      expect(prisma.emailStat.create).toHaveBeenCalledWith({
        data: {
          status: 'processed',
          reason: null,
          subject: 'Test subject',
          from: 'test@test.com',
          productType: null,
        },
      });
    });

    it('passes reason when provided', async () => {
      (prisma.emailStat.create as jest.Mock).mockResolvedValue({});
      await service.recordEmailStat({
        status: 'rejected',
        reason: 'No match',
      });
      expect(prisma.emailStat.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ reason: 'No match', status: 'rejected' }),
      });
    });
  });

  describe('getStats', () => {
    it('returns counts from prisma when days is null', async () => {
      (prisma.emailStat.count as jest.Mock)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(7);

      const result = await service.getStats(null);

      expect(result).toEqual({ processed: 10, accepted: 3, rejected: 7 });
      expect(prisma.emailStat.count).toHaveBeenCalledTimes(3);
    });

    it('passes date filter when days is number', async () => {
      (prisma.emailStat.count as jest.Mock).mockResolvedValue(0);

      await service.getStats(5);

      expect(prisma.emailStat.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          processedAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      });
    });

    it('returns zeros on error', async () => {
      (prisma.emailStat.count as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await service.getStats(null);

      expect(result).toEqual({ processed: 0, accepted: 0, rejected: 0 });
    });
  });

  describe('getAllStats', () => {
    it('returns stats for 1d, 5d, 30d, max', async () => {
      (prisma.emailStat.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getAllStats();

      expect(result).toHaveProperty('1d');
      expect(result).toHaveProperty('5d');
      expect(result).toHaveProperty('30d');
      expect(result).toHaveProperty('max');
      expect(result['1d'].processed).toBe(1);
      expect(result['1d'].accepted).toBe(1);
      expect(result['1d'].rejected).toBe(1);
      expect(result['1d'].byProduct).toEqual({
        laptop: { accepted: 1 },
        monitor: { accepted: 1 },
        desktop: { accepted: 1 },
      });
    });
  });
});
