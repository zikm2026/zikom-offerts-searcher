import { Router, Request, Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { basicAuth } from '../middleware/basicAuth';
import logger from '../utils/logger';
import type { Prisma } from '@prisma/client';
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

const THRESHOLD_KEYS = ['matchThreshold', 'matchThresholdLaptops', 'matchThresholdMonitors', 'matchThresholdDesktops'] as const;

async function getSettings(): Promise<{
  matchThreshold: number;
  matchThresholdLaptops: number;
  matchThresholdMonitors: number;
  matchThresholdDesktops: number;
}> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: [...THRESHOLD_KEYS] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const parse = (key: string): number => {
    const v = map.get(key);
    const n = v ? parseInt(v, 10) : NaN;
    return Number.isNaN(n) ? 90 : Math.min(100, Math.max(0, n));
  };
  const global = parse('matchThreshold');
  return {
    matchThreshold: global,
    matchThresholdLaptops: map.has('matchThresholdLaptops') ? parse('matchThresholdLaptops') : global,
    matchThresholdMonitors: map.has('matchThresholdMonitors') ? parse('matchThresholdMonitors') : global,
    matchThresholdDesktops: map.has('matchThresholdDesktops') ? parse('matchThresholdDesktops') : global,
  };
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
    const updates: { matchThreshold?: number; matchThresholdLaptops?: number; matchThresholdMonitors?: number; matchThresholdDesktops?: number } = {};
    if (req.body.matchThreshold !== undefined) updates.matchThreshold = sanitizeInt(req.body.matchThreshold, 0, 100, 90);
    if (req.body.matchThresholdLaptops !== undefined) updates.matchThresholdLaptops = sanitizeInt(req.body.matchThresholdLaptops, 0, 100, 90);
    if (req.body.matchThresholdMonitors !== undefined) updates.matchThresholdMonitors = sanitizeInt(req.body.matchThresholdMonitors, 0, 100, 90);
    if (req.body.matchThresholdDesktops !== undefined) updates.matchThresholdDesktops = sanitizeInt(req.body.matchThresholdDesktops, 0, 100, 90);
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'Provide at least one threshold' });
    }
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      await prisma.appSetting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      });
    }
    const settings = await getSettings();
    return res.json({ success: true, settings });
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

router.get('/api/admin/monitors', basicAuth, async (_req: Request, res: Response) => {
  try {
    const monitors = await prisma.watchedMonitor.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json({ success: true, monitors });
  } catch (error) {
    logger.error('Error reading monitors:', error);
    return res.status(500).json({ success: false, error: 'Failed to read monitors' });
  }
});

router.post('/api/admin/monitors', basicAuth, async (req: Request, res: Response) => {
  try {
    const sizeInchesMin = req.body.sizeInchesMin != null ? parseFloat(String(req.body.sizeInchesMin)) : null;
    const sizeInchesMax = req.body.sizeInchesMax != null ? parseFloat(String(req.body.sizeInchesMax)) : null;
    const monitor = await prisma.watchedMonitor.create({
      data: {
        model: sanitizeString(req.body.model),
        sizeInchesMin: Number.isNaN(sizeInchesMin) ? null : sizeInchesMin,
        sizeInchesMax: Number.isNaN(sizeInchesMax) ? null : sizeInchesMax,
        resolutionMin: sanitizeString(req.body.resolutionMin),
        resolutionMax: sanitizeString(req.body.resolutionMax),
        maxPrice: sanitizeString(req.body.maxPrice),
      } as unknown as Prisma.WatchedMonitorCreateInput,
    });
    return res.json({ success: true, monitor });
  } catch (error) {
    logger.error('Error adding monitor:', error);
    return res.status(500).json({ success: false, error: 'Failed to add monitor' });
  }
});

router.put('/api/admin/monitors/:id', basicAuth, async (req: Request, res: Response) => {
  if (!isValidUUID(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid id' });
  try {
    const data: any = {};
    if (req.body.model !== undefined) data.model = sanitizeString(req.body.model);
    if (req.body.sizeInchesMin !== undefined) data.sizeInchesMin = req.body.sizeInchesMin == null ? null : parseFloat(String(req.body.sizeInchesMin));
    if (req.body.sizeInchesMax !== undefined) data.sizeInchesMax = req.body.sizeInchesMax == null ? null : parseFloat(String(req.body.sizeInchesMax));
    if (req.body.resolutionMin !== undefined) data.resolutionMin = sanitizeString(req.body.resolutionMin);
    if (req.body.resolutionMax !== undefined) data.resolutionMax = sanitizeString(req.body.resolutionMax);
    if (req.body.maxPrice !== undefined) data.maxPrice = sanitizeString(req.body.maxPrice);
    const monitor = await prisma.watchedMonitor.update({ where: { id: req.params.id }, data });
    return res.json({ success: true, monitor });
  } catch (e: any) {
    if (e.code === 'P2025') return res.status(404).json({ success: false, error: 'Monitor not found' });
    logger.error('Error updating monitor:', e);
    return res.status(500).json({ success: false, error: 'Failed to update monitor' });
  }
});

router.delete('/api/admin/monitors/:id', basicAuth, async (req: Request, res: Response) => {
  if (!isValidUUID(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid id' });
  try {
    await prisma.watchedMonitor.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (e: any) {
    if (e.code === 'P2025') return res.status(404).json({ success: false, error: 'Monitor not found' });
    logger.error('Error deleting monitor:', e);
    return res.status(500).json({ success: false, error: 'Failed to delete monitor' });
  }
});

const DESKTOP_CASE_TYPES = ['Tower', 'SFF', 'Mini'];
function sanitizeCaseType(v: unknown): string {
  const s = String(v ?? '').trim();
  return DESKTOP_CASE_TYPES.includes(s) ? s : 'Tower';
}

router.get('/api/admin/desktops', basicAuth, async (_req: Request, res: Response) => {
  try {
    const desktops = await prisma.watchedDesktop.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json({ success: true, desktops });
  } catch (error) {
    logger.error('Error reading desktops:', error);
    return res.status(500).json({ success: false, error: 'Failed to read desktops' });
  }
});

router.post('/api/admin/desktops', basicAuth, async (req: Request, res: Response) => {
  try {
    const desktop = await prisma.watchedDesktop.create({
      data: {
        caseType: sanitizeCaseType(req.body.caseType),
        maxPrice: sanitizeString(req.body.maxPrice),
        ramFrom: sanitizeString(req.body.ramFrom),
        ramTo: sanitizeString(req.body.ramTo),
        storageFrom: sanitizeString(req.body.storageFrom),
        storageTo: sanitizeString(req.body.storageTo),
      },
    });
    return res.json({ success: true, desktop });
  } catch (error) {
    logger.error('Error adding desktop:', error);
    return res.status(500).json({ success: false, error: 'Failed to add desktop' });
  }
});

router.put('/api/admin/desktops/:id', basicAuth, async (req: Request, res: Response) => {
  if (!isValidUUID(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid id' });
  try {
    const data: any = {};
    if (req.body.caseType !== undefined) data.caseType = sanitizeCaseType(req.body.caseType);
    if (req.body.maxPrice !== undefined) data.maxPrice = sanitizeString(req.body.maxPrice);
    if (req.body.ramFrom !== undefined) data.ramFrom = sanitizeString(req.body.ramFrom);
    if (req.body.ramTo !== undefined) data.ramTo = sanitizeString(req.body.ramTo);
    if (req.body.storageFrom !== undefined) data.storageFrom = sanitizeString(req.body.storageFrom);
    if (req.body.storageTo !== undefined) data.storageTo = sanitizeString(req.body.storageTo);
    const desktop = await prisma.watchedDesktop.update({ where: { id: req.params.id }, data });
    return res.json({ success: true, desktop });
  } catch (e: any) {
    if (e.code === 'P2025') return res.status(404).json({ success: false, error: 'Desktop not found' });
    logger.error('Error updating desktop:', e);
    return res.status(500).json({ success: false, error: 'Failed to update desktop' });
  }
});

router.delete('/api/admin/desktops/:id', basicAuth, async (req: Request, res: Response) => {
  if (!isValidUUID(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid id' });
  try {
    await prisma.watchedDesktop.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (e: any) {
    if (e.code === 'P2025') return res.status(404).json({ success: false, error: 'Desktop not found' });
    logger.error('Error deleting desktop:', e);
    return res.status(500).json({ success: false, error: 'Failed to delete desktop' });
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

