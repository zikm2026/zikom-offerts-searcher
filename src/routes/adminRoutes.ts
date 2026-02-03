import { Router, Request, Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { basicAuth } from '../middleware/basicAuth';
import logger from '../utils/logger';
import prisma from '../lib/prisma';
import EmailStatsService from '../services/emailStatsService';

const router = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_STRING_LENGTH = 500;

function isValidUUID(id: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

function sanitizeString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length === 0 ? null : s.slice(0, MAX_STRING_LENGTH);
}

const VALID_GRADES = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
function sanitizeGrade(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim().toUpperCase();
  if (s.length === 0) return null;
  return VALID_GRADES.has(s) ? s : null;
}

function sanitizeInt(value: unknown, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  const n = parseInt(String(value), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

router.get('/admin', basicAuth, async (_req: Request, res: Response) => {
  try {
    const html = await fs.readFile(
      path.join(process.cwd(), 'public', 'admin.html'),
      'utf-8'
    );
    res.send(html);
  } catch (error) {
    logger.error('Error serving admin panel:', error);
    res.status(500).send('Error loading admin panel');
  }
});

router.get('/api/admin/laptops', basicAuth, async (_req: Request, res: Response) => {
  try {
    const [laptops, settings] = await Promise.all([
      prisma.watchedLaptop.findMany({ orderBy: { createdAt: 'desc' } }),
      getSettings(),
    ]);
    return res.json({ success: true, laptops, settings });
  } catch (error) {
    logger.error('Error reading laptops list:', error);
    return res.status(500).json({ success: false, error: 'Failed to read laptops list' });
  }
});

async function getSettings(): Promise<{ matchThreshold: number }> {
  const row = await prisma.appSetting.findUnique({
    where: { key: 'matchThreshold' },
  });
  const value = row?.value ? parseInt(row.value, 10) : 90;
  const matchThreshold = Number.isNaN(value) ? 90 : Math.min(100, Math.max(0, value));
  return { matchThreshold };
}

router.get('/api/admin/settings', basicAuth, async (_req: Request, res: Response) => {
  try {
    const settings = await getSettings();
    return res.json({ success: true, settings });
  } catch (error) {
    logger.error('Error reading settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to read settings' });
  }
});

router.patch('/api/admin/settings', basicAuth, async (req: Request, res: Response) => {
  try {
    const matchThreshold =
      req.body.matchThreshold !== undefined
        ? sanitizeInt(req.body.matchThreshold, 0, 100, 90)
        : undefined;
    if (matchThreshold === undefined) {
      return res.status(400).json({ success: false, error: 'matchThreshold is required' });
    }
    await prisma.appSetting.upsert({
      where: { key: 'matchThreshold' },
      create: { key: 'matchThreshold', value: String(matchThreshold) },
      update: { value: String(matchThreshold) },
    });
    return res.json({ success: true, settings: { matchThreshold } });
  } catch (error) {
    logger.error('Error updating settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

router.post('/api/admin/laptops', basicAuth, async (req: Request, res: Response) => {
  try {
    const model = sanitizeString(req.body.model) ?? '';
    if (!model) {
      return res.status(400).json({ success: false, error: 'Model is required' });
    }

    const newLaptop = await prisma.watchedLaptop.create({
      data: {
        model,
        maxPriceWorst: sanitizeString(req.body.maxPriceWorst),
        maxPriceBest: sanitizeString(req.body.maxPriceBest),
        ramFrom: sanitizeString(req.body.ramFrom),
        ramTo: sanitizeString(req.body.ramTo),
        storageFrom: sanitizeString(req.body.storageFrom),
        storageTo: sanitizeString(req.body.storageTo),
        gradeFrom: sanitizeGrade(req.body.gradeFrom),
        gradeTo: sanitizeGrade(req.body.gradeTo),
        graphicsCard: sanitizeString(req.body.graphicsCard),
      },
    });

    return res.json({ success: true, laptop: newLaptop });
  } catch (error) {
    logger.error('Error adding laptop:', error);
    return res.status(500).json({ success: false, error: 'Failed to add laptop' });
  }
});

router.put('/api/admin/laptops/:id', basicAuth, async (req: Request, res: Response) => {
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ success: false, error: 'Invalid laptop id' });
  }
  try {
    const updateData: {
      model?: string;
      maxPriceWorst?: string | null;
      maxPriceBest?: string | null;
      ramFrom?: string | null;
      ramTo?: string | null;
      storageFrom?: string | null;
      storageTo?: string | null;
      gradeFrom?: string | null;
      gradeTo?: string | null;
      graphicsCard?: string | null;
    } = {};

    if (req.body.model !== undefined) {
      const m = sanitizeString(req.body.model);
      updateData.model = m ?? undefined;
    }
    if (req.body.maxPriceWorst !== undefined) updateData.maxPriceWorst = sanitizeString(req.body.maxPriceWorst);
    if (req.body.maxPriceBest !== undefined) updateData.maxPriceBest = sanitizeString(req.body.maxPriceBest);
    if (req.body.ramFrom !== undefined) updateData.ramFrom = sanitizeString(req.body.ramFrom);
    if (req.body.ramTo !== undefined) updateData.ramTo = sanitizeString(req.body.ramTo);
    if (req.body.storageFrom !== undefined) updateData.storageFrom = sanitizeString(req.body.storageFrom);
    if (req.body.storageTo !== undefined) updateData.storageTo = sanitizeString(req.body.storageTo);
    if (req.body.gradeFrom !== undefined) updateData.gradeFrom = sanitizeGrade(req.body.gradeFrom);
    if (req.body.gradeTo !== undefined) updateData.gradeTo = sanitizeGrade(req.body.gradeTo);
    if (req.body.graphicsCard !== undefined) updateData.graphicsCard = sanitizeString(req.body.graphicsCard);

    const updatedLaptop = await prisma.watchedLaptop.update({
      where: { id: req.params.id },
      data: updateData,
    });

    return res.json({ success: true, laptop: updatedLaptop });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Laptop not found' });
    }
    logger.error('Error updating laptop:', error);
    return res.status(500).json({ success: false, error: 'Failed to update laptop' });
  }
});

router.delete('/api/admin/laptops/:id', basicAuth, async (req: Request, res: Response) => {
  if (!isValidUUID(req.params.id)) {
    return res.status(400).json({ success: false, error: 'Invalid laptop id' });
  }
  try {
    await prisma.watchedLaptop.delete({
      where: { id: req.params.id },
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Laptop not found' });
    }
    logger.error('Error deleting laptop:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete laptop' });
  }
});

router.get('/api/admin/stats', basicAuth, async (_req: Request, res: Response) => {
  try {
    const statsService = new EmailStatsService();
    const stats = await statsService.getAllStats();
    return res.json({ success: true, stats });
  } catch (error) {
    logger.error('Error getting email stats:', error);
    return res.status(500).json({ success: false, error: 'Failed to get email stats' });
  }
});

export default router;

