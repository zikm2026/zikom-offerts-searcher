import dotenv from 'dotenv';

dotenv.config();

interface EmailConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
  checkInterval: number;
  processTimeoutMs: number;
}

interface GeminiConfig {
  apiKey: string;
  model: string;
}

interface DatabaseConfig {
  url: string;
}

export interface NtfyConfig {
  topic: string;
  server?: string;
  token?: string;
  enabled: boolean;
}

export interface AdminConfig {
  username: string;
  password: string;
}

interface Config {
  env: string;
  port: number;
  apiVersion: string;
  cors: {
    origin: string | string[];
  };
  database?: DatabaseConfig;
  jwt?: {
    secret: string;
    expiresIn: string;
  };
  admin: AdminConfig;
  email?: EmailConfig;
  gemini?: GeminiConfig;
  ntfy?: NtfyConfig;
}

const isProd = process.env.NODE_ENV === 'production';
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

if (isProd && (!process.env.DATABASE_URL || process.env.DATABASE_URL.length < 10)) {
  throw new Error('Production requires DATABASE_URL to be set in environment');
}

if (isProd && adminPassword === 'admin123') {
  console.warn('⚠️  SECURITY: Using default ADMIN_PASSWORD in production. Set ADMIN_PASSWORD in .env');
}

const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiVersion: process.env.API_VERSION || 'v1',
  cors: {
    origin: process.env.CORS_ORIGIN || (isProd ? 'http://localhost:3000' : '*'),
  },
  admin: {
    username: adminUsername,
    password: adminPassword,
  },
  database: process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : undefined,
  jwt: process.env.JWT_SECRET
    ? {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      }
    : undefined,
  email:
    process.env.ENABLE_EMAIL_SERVICE !== 'false' &&
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASSWORD
      ? {
          user: process.env.EMAIL_USER,
          password: process.env.EMAIL_PASSWORD,
          host: process.env.EMAIL_HOST || 'imap.home.pl',
          port: parseInt(process.env.EMAIL_PORT || '993', 10),
          tls: process.env.EMAIL_TLS !== 'false',
          checkInterval: parseInt(
            process.env.EMAIL_CHECK_INTERVAL || '60000',
            10
          ),
          processTimeoutMs: parseInt(
            process.env.EMAIL_PROCESS_TIMEOUT_MS || '120000',
            10
          ),
        }
      : undefined,
  gemini: process.env.GEMINI_API_KEY
    ? {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
      }
    : undefined,
  ntfy: process.env.NTFY_TOPIC
    ? {
        topic: process.env.NTFY_TOPIC,
        server: process.env.NTFY_SERVER || 'https://ntfy.sh',
        token: process.env.NTFY_TOKEN,
        enabled: process.env.NTFY_ENABLED !== 'false',
      }
    : undefined,
};

export default config;

