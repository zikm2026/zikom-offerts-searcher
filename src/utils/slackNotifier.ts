const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL?.trim();

function formatErrorForSlack(arg: unknown): string {
  if (arg instanceof Error) {
    const stack = (arg.stack || '').split('\n').slice(0, 5).join('\n');
    return `${arg.message}\n\`\`\`${stack}\`\`\``;
  }
  if (arg !== null && typeof arg === 'object') return JSON.stringify(arg).slice(0, 800);
  return String(arg);
}

export function notifySlackError(message: string, ...args: unknown[]): void {
  if (!SLACK_WEBHOOK_URL || SLACK_WEBHOOK_URL.length < 10) return;

  const timestamp = new Date().toISOString();
  const extra = args.length > 0 ? '\n' + args.map(formatErrorForSlack).join('\n') : '';
  const text = `[ERROR] ${timestamp}\n${message}${extra}`.slice(0, 3000);

  fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch(() => {});
}
