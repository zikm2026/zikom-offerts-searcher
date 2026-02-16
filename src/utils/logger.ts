import { notifySlackError } from './slackNotifier';

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

function getMinLevel(): LogLevel {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  if (env && env in LOG_LEVELS) return env as LogLevel;
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

const minLevel = getMinLevel();
const minLevelNum = LOG_LEVELS[minLevel];

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] <= minLevelNum;
}

const logger = {
  error: (message: string, ...args: any[]): void => {
    if (!shouldLog('error')) return;
    const line = `[ERROR] ${new Date().toISOString()} - ${message}`;
    console.error(line, ...args);
    notifySlackError(message, ...args);
  },
  warn: (message: string, ...args: any[]): void => {
    if (!shouldLog('warn')) return;
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
  },
  info: (message: string, ...args: any[]): void => {
    if (!shouldLog('info')) return;
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]): void => {
    if (!shouldLog('debug')) return;
    console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
  },
  level: minLevel,
};

export default logger;

