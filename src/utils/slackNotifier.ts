const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL?.trim();

export function notifySlackError(message: string, ...args: unknown[]): void {
  if (!SLACK_WEBHOOK_URL || SLACK_WEBHOOK_URL.length < 10) return;

  const timestamp = new Date().toISOString();
  const extra = args.length > 0 ? '\n`' + JSON.stringify(args).slice(0, 500) + '`' : '';
  const text = `[ERROR] ${timestamp}\n${message}${extra}`;

  fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch(() => {
  });
}
