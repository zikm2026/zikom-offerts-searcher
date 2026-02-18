import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { EmailMessage } from '../../../types/email';
import logger from '../../../utils/logger';

export class ImapMessageFetcher {
  private imap: Imap;
  private lastCheckedUid: number = 0;
  private isChecking: boolean = false;

  constructor(imap: Imap) {
    this.imap = imap;
  }

  setLastCheckedUid(uid: number): void {
    this.lastCheckedUid = uid;
  }

  getLastCheckedUid(): number {
    return this.lastCheckedUid;
  }

  markAsSeen(uid: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap.addFlags(uid, ['\\Seen'], (err) => {
        if (err) {
          logger.warn(`Could not mark UID ${uid} as seen: ${(err as Error).message}`);
          reject(err);
        } else {
          logger.debug(`Marked UID ${uid} as seen`);
          resolve();
        }
      });
    });
  }

  async fetchNewMessages(timeoutMs: number = 60000): Promise<EmailMessage[]> {
    if (this.isChecking) {
      logger.debug('Email check already in progress, skipping...');
      return [];
    }

    this.isChecking = true;

    const timeoutPromise = new Promise<EmailMessage[]>((resolve) => {
      setTimeout(() => {
        if (this.isChecking) {
          logger.warn(`⏱️ IMAP fetch timeout (${timeoutMs / 1000}s) – resetuję flagę i zwracam pustą listę`);
          this.isChecking = false;
        }
        resolve([]);
      }, timeoutMs);
    });

    try {
      const box = await this.openInbox();

      if (this.lastCheckedUid === 0) {
        this.lastCheckedUid = box.uidnext - 1;
        logger.info(`Initial email check. Starting from UID: ${this.lastCheckedUid + 1}`);
        this.isChecking = false;
        return [];
      }

      return await Promise.race([this.searchAndFetchMessages(), timeoutPromise]);
    } catch (error) {
      this.isChecking = false;
      throw error;
    }
  }

  private openInbox(): Promise<Imap.Box> {
    return new Promise((resolve, reject) => {
      this.imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(box);
      });
    });
  }

  private async searchAndFetchMessages(): Promise<EmailMessage[]> {
    const searchCriteria = [['UNSEEN'], ['UID', `${this.lastCheckedUid + 1}:*`]];

    return new Promise((resolve, reject) => {
      this.imap.search(searchCriteria, (err, results) => {
        if (err) {
          this.isChecking = false;
          reject(err);
          return;
        }

        if (!results || results.length === 0) {
          this.isChecking = false;
          resolve([]);
          return;
        }

        this.fetchMessages(results, resolve, reject);
      });
    });
  }

  private fetchMessages(
    results: number[],
    resolve: (messages: EmailMessage[]) => void,
    reject: (error: Error) => void
  ): void {
    const fetch = this.imap.fetch(results, {
      bodies: '',
      struct: true,
    });

    const messages: EmailMessage[] = [];
    let pendingCount = 0;
    let fetchEnded = false;
    let resolved = false;

    const tryResolve = () => {
      if (resolved) return;
      if (fetchEnded && pendingCount === 0) {
        resolved = true;
        this.isChecking = false;
        resolve(messages);
      }
    };

    fetch.on('message', (msg) => {
      pendingCount++;
      let uid: number | null = null;
      let buffer = '';

      msg.on('body', (stream) => {
        stream.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf8');
        });
      });

      msg.once('attributes', (attrs) => {
        uid = attrs.uid;
      });

      msg.once('end', async () => {
        try {
          if (uid === null) {
            logger.warn('Received message without UID, skipping...');
            return;
          }

          const emailMessage = await this.parseMessage(buffer, uid);
          messages.push(emailMessage);
          this.lastCheckedUid = Math.max(this.lastCheckedUid, uid);
        } catch (parseErr) {
          logger.error('Error parsing email:', parseErr);
        } finally {
          pendingCount--;
          tryResolve();
        }
      });
    });

    fetch.once('end', () => {
      fetchEnded = true;
      tryResolve();
    });

    fetch.once('error', (fetchErr) => {
      if (resolved) return;
      resolved = true;
      logger.error('Error fetching messages:', fetchErr);
      this.isChecking = false;
      reject(fetchErr);
    });
  }

  private async parseMessage(buffer: string, uid: number): Promise<EmailMessage> {
    const parsed = await simpleParser(buffer);

    const emailMessage: EmailMessage = {
      uid,
      from: parsed.from?.text || 'Unknown',
      subject: parsed.subject || '(No Subject)',
      date: parsed.date || new Date(),
      text: parsed.text || undefined,
      html: parsed.html || undefined,
    };

    const attachments = parsed.attachments?.map(att => ({
      filename: att.filename || 'unknown',
      contentType: att.contentType || 'application/octet-stream',
      size: att.size || 0,
      content: att.content,
    })) || [];

    if (attachments.length > 0) {
      (emailMessage as any).attachments = attachments;
    }

    return emailMessage;
  }

}

