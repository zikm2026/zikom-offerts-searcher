import { Router, Request, Response } from 'express';
import config from '../config/index';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    version: config.apiVersion,
  });
});

export default router;

