import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import config from '../config/index';

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  if (bufA.length === 0) return true;
  return crypto.timingSafeEqual(bufA, bufB);
}

export const basicAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
    res.status(401).send('Unauthorized');
    return;
  }

  const base64Credentials = authHeader.split(' ')[1];
  if (!base64Credentials) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
    res.status(401).send('Unauthorized');
    return;
  }

  let credentials: string;
  try {
    credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  } catch {
    res.status(401).send('Unauthorized');
    return;
  }

  const colonIndex = credentials.indexOf(':');
  const username = colonIndex === -1 ? '' : credentials.slice(0, colonIndex);
  const password = colonIndex === -1 ? '' : credentials.slice(colonIndex + 1);

  const userOk = timingSafeEqual(username, config.admin.username);
  const passOk = timingSafeEqual(password, config.admin.password);
  if (userOk && passOk) {
    next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
    res.status(401).send('Unauthorized');
  }
};

