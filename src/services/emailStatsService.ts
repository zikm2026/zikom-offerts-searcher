import prisma from '../lib/prisma';
import logger from '../utils/logger';

export type EmailStatus = 'processed' | 'accepted' | 'rejected';

interface EmailStatData {
  status: EmailStatus;
  reason?: string;
  subject?: string;
  from?: string;
}

class EmailStatsService {
  async recordEmailStat(data: EmailStatData): Promise<void> {
    try {
      await prisma.emailStat.create({
        data: {
          status: data.status,
          reason: data.reason || null,
          subject: data.subject || null,
          from: data.from || null,
        },
      });
    } catch (error) {
      logger.error('Error recording email stat:', error);
    }
  }

  async getStats(days: number | null): Promise<{
    processed: number;
    accepted: number;
    rejected: number;
  }> {
    try {
      const where: any = {};
      
      if (days !== null) {
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - days);
        where.processedAt = {
          gte: dateFrom,
        };
      }

      const [processed, accepted, rejected] = await Promise.all([
        prisma.emailStat.count({
          where: { ...where, status: 'processed' },
        }),
        prisma.emailStat.count({
          where: { ...where, status: 'accepted' },
        }),
        prisma.emailStat.count({
          where: { ...where, status: 'rejected' },
        }),
      ]);

      return { processed, accepted, rejected };
    } catch (error) {
      logger.error('Error getting email stats:', error);
      return { processed: 0, accepted: 0, rejected: 0 };
    }
  }

  async getAllStats(): Promise<{
    '1d': { processed: number; accepted: number; rejected: number };
    '5d': { processed: number; accepted: number; rejected: number };
    '30d': { processed: number; accepted: number; rejected: number };
    max: { processed: number; accepted: number; rejected: number };
  }> {
    const [stats1d, stats5d, stats30d, statsMax] = await Promise.all([
      this.getStats(1),
      this.getStats(5),
      this.getStats(30),
      this.getStats(null),
    ]);

    return {
      '1d': stats1d,
      '5d': stats5d,
      '30d': stats30d,
      max: statsMax,
    };
  }
}

export default EmailStatsService;

