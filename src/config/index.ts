import dotenv from 'dotenv';

dotenv.config();

interface EmailConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
  checkInterval: number;
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
  email?: EmailConfig;
  gemini?: GeminiConfig;
  ntfy?: NtfyConfig;
}

const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiVersion: process.env.API_VERSION || 'v1',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  database: process.env.DATABASE_URL
    ? {
        url: process.env.DATABASE_URL,
      }
    : undefined,
  jwt: process.env.JWT_SECRET
    ? {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      }
    : undefined,
  email:
    process.env.EMAIL_USER && process.env.EMAIL_PASSWORD
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

