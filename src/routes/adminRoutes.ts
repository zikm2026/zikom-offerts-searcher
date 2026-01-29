import { Router, Request, Response } from 'express';
import { basicAuth } from '../middleware/basicAuth';
import * as fs from 'fs/promises';
import * as path from 'path';
import logger from '../utils/logger';
import prisma from '../lib/prisma';

const router = Router();

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
    const laptops = await prisma.watchedLaptop.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, laptops });
  } catch (error) {
    logger.error('Error reading laptops list:', error);
    return res.status(500).json({ success: false, error: 'Failed to read laptops list' });
  }
});

router.post('/api/admin/laptops', basicAuth, async (req: Request, res: Response) => {
  try {
    const matchThreshold = req.body.matchThreshold 
      ? parseInt(req.body.matchThreshold, 10) 
      : 90;
    
    const newLaptop = await prisma.watchedLaptop.create({
      data: {
        model: req.body.model || '',
        maxPriceWorst: req.body.maxPriceWorst || null,
        maxPriceBest: req.body.maxPriceBest || null,
        ramFrom: req.body.ramFrom || null,
        ramTo: req.body.ramTo || null,
        storageFrom: req.body.storageFrom || null,
        storageTo: req.body.storageTo || null,
        gradeFrom: req.body.gradeFrom || null,
        gradeTo: req.body.gradeTo || null,
        graphicsCard: req.body.graphicsCard || null,
        matchThreshold: matchThreshold >= 0 && matchThreshold <= 100 ? matchThreshold : 90,
      } as any,
    });

    return res.json({ success: true, laptop: newLaptop });
  } catch (error) {
    logger.error('Error adding laptop:', error);
    return res.status(500).json({ success: false, error: 'Failed to add laptop' });
  }
});

router.put('/api/admin/laptops/:id', basicAuth, async (req: Request, res: Response) => {
  try {
    const matchThreshold = req.body.matchThreshold !== undefined
      ? parseInt(req.body.matchThreshold, 10)
      : undefined;
    
    const updateData: any = {
      model: req.body.model,
      maxPriceWorst: req.body.maxPriceWorst !== undefined ? req.body.maxPriceWorst : undefined,
      maxPriceBest: req.body.maxPriceBest !== undefined ? req.body.maxPriceBest : undefined,
      ramFrom: req.body.ramFrom !== undefined ? req.body.ramFrom : undefined,
      ramTo: req.body.ramTo !== undefined ? req.body.ramTo : undefined,
      storageFrom: req.body.storageFrom !== undefined ? req.body.storageFrom : undefined,
      storageTo: req.body.storageTo !== undefined ? req.body.storageTo : undefined,
      gradeFrom: req.body.gradeFrom !== undefined ? req.body.gradeFrom : undefined,
      gradeTo: req.body.gradeTo !== undefined ? req.body.gradeTo : undefined,
      graphicsCard: req.body.graphicsCard !== undefined ? req.body.graphicsCard : undefined,
    };
    
    if (matchThreshold !== undefined && matchThreshold >= 0 && matchThreshold <= 100) {
      updateData.matchThreshold = matchThreshold;
    }
    
    const updatedLaptop = await prisma.watchedLaptop.update({
      where: { id: req.params.id },
      data: updateData,
    });

    return res.json({ success: true, laptop: updatedLaptop });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Laptop not found' });
    }
    logger.error('Error updating laptop:', error);
    return res.status(500).json({ success: false, error: 'Failed to update laptop' });
  }
});

router.delete('/api/admin/laptops/:id', basicAuth, async (req: Request, res: Response) => {
  try {
    await prisma.watchedLaptop.delete({
      where: { id: req.params.id },
    });

    return res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Laptop not found' });
    }
    logger.error('Error deleting laptop:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete laptop' });
  }
});

router.get('/api/admin/stats', basicAuth, async (_req: Request, res: Response) => {
  try {
    const EmailStatsService = (await import('../services/emailStatsService')).default;
    const statsService = new EmailStatsService();
    const stats = await statsService.getAllStats();
    
    return res.json({ success: true, stats });
  } catch (error) {
    logger.error('Error getting email stats:', error);
    return res.status(500).json({ success: false, error: 'Failed to get email stats' });
  }
});

export default router;

