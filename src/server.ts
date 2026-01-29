import app from './app';
import config from './config/index';
import logger from '@utils/logger';
import { EmailService } from './services/email';
import GeminiService from './services/geminiService';
import NotificationService from './services/notificationService';
import { AnalyzedEmail } from './types/email';
import prisma from './lib/prisma';

let emailService: EmailService | null = null;
let geminiService: GeminiService | null = null;
let notificationService: NotificationService | null = null;

if (config.gemini) {
  try {
    geminiService = new GeminiService(config.gemini);
    logger.info('Gemini AI service initialized');
  } catch (error) {
    logger.error('Failed to initialize Gemini service:', error);
  }
}

if (config.ntfy) {
  try {
    notificationService = new NotificationService(config.ntfy);
    logger.info(`Notification service initialized (topic: ${config.ntfy.topic})`);
  } catch (error) {
    logger.error('Failed to initialize notification service:', error);
  }
}

if (config.email) {
  emailService = new EmailService(
    config.email,
    geminiService || undefined,
    notificationService || undefined
  );

  emailService.on('connected', () => {
    logger.info('Email service connected');
  });

  emailService.on('disconnected', () => {
    logger.warn('Email service disconnected');
  });

  emailService.on('error', (err: Error) => {
    logger.error('Email service error:', err);
  });

  emailService.on('newMail', (message: AnalyzedEmail) => {
    if (message.analysis?.isOffer) {
      logger.info(`🎯 Laptop offer processed - From: ${message.from}, Subject: ${message.subject}`);
    } else {
      logger.debug(`📧 Regular email processed - From: ${message.from}, Subject: ${message.subject}`);
    }
  });

  emailService
    .connect()
    .then(() => {
      return emailService!.startChecking();
    })
    .catch((err: any) => {
      if (err.source === 'authentication' || err.type === 'no') {
        logger.error('Email service authentication failed. Server will continue without email monitoring.');
        logger.warn('To enable email monitoring:');
        logger.warn('- Check EMAIL_USER and EMAIL_PASSWORD in .env file');
        logger.warn('- Enable IMAP access in your email account settings');
      } else {
        logger.error('Failed to initialize email service:', err);
      }
    });
}

const server = app.listen(config.port, () => {
  logger.info(`Server running in ${config.env} mode on port ${config.port}`);
  logger.info(`API version: ${config.apiVersion}`);
  
  if (config.email) {
    logger.info(`📧 Email service configured for: ${config.email.user}`);
  } else {
    logger.warn('📧 Email service not configured. Set EMAIL_USER and EMAIL_PASSWORD in .env');
  }
  
  if (config.gemini) {
    logger.info(`🤖 Gemini AI configured with model: ${config.gemini.model}`);
  } else {
    logger.warn('🤖 Gemini AI not configured. Set GEMINI_API_KEY in .env for AI analysis');
  }
  
  if (config.ntfy) {
    logger.info(`📱 Notification service configured (topic: ${config.ntfy.topic})`);
  } else {
    logger.warn('📱 Notification service not configured. Set NTFY_TOPIC in .env for push notifications');
  }
});

const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  if (emailService) {
    try {
      emailService.stopChecking();
      await emailService.disconnect();
      logger.info('Email service stopped');
    } catch (err) {
      logger.error('Error stopping email service:', err);
    }
  }

  try {
    await prisma.$disconnect();
    logger.info('Database connection closed');
  } catch (err) {
    logger.error('Error closing database connection:', err);
  }

  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (err: Error) => {
  logger.error('Unhandled Promise Rejection:', err);
  gracefulShutdown('unhandledRejection');
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

export default server;

