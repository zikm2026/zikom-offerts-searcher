export interface RetryableErrorLike {
  status?: number;
  statusText?: string;
  message?: string;
}

export function isRetryableError(error: RetryableErrorLike | unknown): boolean {
  const e = error as RetryableErrorLike;
  if (!e) return false;
  if (e.status === 503 || e.status === 429 || e.status === 500) return true;
  if (e.statusText === 'Service Unavailable') return true;
  const msg = (e.message ?? '').toLowerCase();
  return msg.includes('overloaded') || msg.includes('rate limit');
}

export function getRetryDelayMs(attemptsLeft: number): number {
  return Math.min(Math.pow(2, 6 - attemptsLeft) * 1000, 30000);
}
