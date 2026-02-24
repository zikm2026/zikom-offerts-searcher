import prisma from '../lib/prisma';
import logger from '../utils/logger';

export type EmailStatus = 'processed' | 'accepted' | 'rejected';
export type ProductType = 'laptop' | 'monitor' | 'desktop';

interface EmailStatData {
  status: EmailStatus;
  reason?: string;
  subject?: string;
  from?: string;
  productType?: ProductType;
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
          productType: data.productType || null,
        },
      });
    } catch (error) {
      logger.error('Error recording email stat:', error);
    }
  }

  async getStats(days: number | null, productType?: ProductType | null): Promise<{
    processed: number;
    accepted: number;
    rejected: number;
    byProduct?: { laptop: { accepted: number }; monitor: { accepted: number }; desktop: { accepted: number } };
  }> {
    try {
      const where: any = {};
      if (days !== null) {
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - days);
        where.processedAt = { gte: dateFrom };
      }
      if (productType) {
        where.productType = productType;
      }

      const [processed, accepted, rejected] = await Promise.all([
        prisma.emailStat.count({ where: { ...where, status: 'processed' } }),
        prisma.emailStat.count({ where: { ...where, status: 'accepted' } }),
        prisma.emailStat.count({ where: { ...where, status: 'rejected' } }),
      ]);

      const result: { processed: number; accepted: number; rejected: number; byProduct?: { laptop: { accepted: number }; monitor: { accepted: number }; desktop: { accepted: number } } } = { processed, accepted, rejected };

      if (days !== null && !productType) {
        const baseWhere = { ...where, status: 'accepted' as const };
        const [laptopAccepted, monitorAccepted, desktopAccepted] = await Promise.all([
          prisma.emailStat.count({ where: { ...baseWhere, productType: 'laptop' } }),
          prisma.emailStat.count({ where: { ...baseWhere, productType: 'monitor' } }),
          prisma.emailStat.count({ where: { ...baseWhere, productType: 'desktop' } }),
        ]);
        result.byProduct = {
          laptop: { accepted: laptopAccepted },
          monitor: { accepted: monitorAccepted },
          desktop: { accepted: desktopAccepted },
        };
      }

      return result;
    } catch (error) {
      logger.error('Error getting email stats:', error);
      return { processed: 0, accepted: 0, rejected: 0 };
    }
  }

  async getAllStats(): Promise<{
    '1d': { processed: number; accepted: number; rejected: number; byProduct?: { laptop: { accepted: number }; monitor: { accepted: number }; desktop: { accepted: number } } };
    '5d': { processed: number; accepted: number; rejected: number; byProduct?: { laptop: { accepted: number }; monitor: { accepted: number }; desktop: { accepted: number } } };
    '30d': { processed: number; accepted: number; rejected: number; byProduct?: { laptop: { accepted: number }; monitor: { accepted: number }; desktop: { accepted: number } } };
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

