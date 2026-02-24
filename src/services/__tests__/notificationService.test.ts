import NotificationService from '../notificationService';
import type { EmailMatchResult } from '../../types/email';

const mockFetch = jest.fn();

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  describe('config.enabled = false', () => {
    it('sendLaptopMatchNotification returns false when notifications disabled', async () => {
      const service = new NotificationService({
        topic: 'test-topic',
        server: 'https://ntfy.sh',
        enabled: false,
      });

      const result = await service.sendLaptopMatchNotification('Test subject', {
        allLaptopsMatched: true,
        matchedCount: 1,
        totalCount: 1,
        matches: [
          {
            laptop: { model: 'Dell 7430', ram: '16 GB', storage: '512 GB', price: '400 EUR' },
            watchedLaptop: { id: 'w1', model: 'Dell 7430' },
            maxAllowedPrice: 500,
            actualPrice: 400,
            isMatch: true,
            reason: 'OK',
          },
        ],
        shouldNotify: true,
      });

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sendLaptopRejectedNotification returns false when notifications disabled', async () => {
      const service = new NotificationService({
        topic: 'test-topic',
        server: 'https://ntfy.sh',
        enabled: false,
      });

      const result = await service.sendLaptopRejectedNotification('Subject', {
        allLaptopsMatched: false,
        matchedCount: 0,
        totalCount: 2,
        matches: [
          {
            laptop: { model: 'X' },
            watchedLaptop: { id: '', model: '(nie w bazie)' },
            maxAllowedPrice: 0,
            actualPrice: 0,
            isMatch: false,
            reason: 'Nie ma w bazie',
          },
        ],
        shouldNotify: false,
      });

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('sendLaptopMatchNotification', () => {
    it('returns false when no matched laptops (only rejected)', async () => {
      const service = new NotificationService({
        topic: 'test-topic',
        server: 'https://ntfy.sh',
        enabled: true,
      });

      const matchResult: EmailMatchResult = {
        allLaptopsMatched: false,
        matchedCount: 0,
        totalCount: 1,
        matches: [
          {
            laptop: { model: 'Unknown' },
            watchedLaptop: { id: '', model: '(nie w bazie)' },
            maxAllowedPrice: 0,
            actualPrice: 0,
            isMatch: false,
            reason: 'Nie ma w bazie',
          },
        ],
        shouldNotify: false,
      };

      const result = await service.sendLaptopMatchNotification('Subject', matchResult);

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('calls fetch with correct URL and POST when enabled and has matches', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const service = new NotificationService({
        topic: 'zikom-laptopy',
        server: 'https://ntfy.sh',
        enabled: true,
      });

      const result = await service.sendLaptopMatchNotification('Oferta test', {
        allLaptopsMatched: true,
        matchedCount: 1,
        totalCount: 1,
        matches: [
          {
            laptop: { model: 'ThinkPad X1', ram: '16 GB', storage: '512 GB', price: '800 EUR' },
            watchedLaptop: { id: 'w1', model: 'ThinkPad X1' },
            maxAllowedPrice: 900,
            actualPrice: 800,
            isMatch: true,
            reason: 'OK',
          },
        ],
        shouldNotify: true,
      });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://ntfy.sh/zikom-laptopy',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Title': expect.stringContaining('Znaleziono'),
            'X-Priority': 'high',
          }),
        })
      );
      const body = (mockFetch.mock.calls[0][1] as RequestInit).body as Buffer;
      const message = body.toString('utf-8');
      expect(message).toContain('Oferta test');
      expect(message).toContain('ThinkPad X1');
      expect(message).toContain('1/1 laptopow spelnia kryteria');
    });
  });

  describe('sendTestNotification', () => {
    it('returns false when disabled', async () => {
      const service = new NotificationService({
        topic: 'test',
        server: 'https://ntfy.sh',
        enabled: false,
      });
      const result = await service.sendTestNotification();
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('calls fetch when enabled', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const service = new NotificationService({
        topic: 'test-topic',
        server: 'https://ntfy.sh',
        enabled: true,
      });
      const result = await service.sendTestNotification();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://ntfy.sh/test-topic',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Title': 'Test powiadomienia',
          }),
        })
      );
    });
  });
});
