export function normalizeToGB(value: string | undefined): number | null {
  if (!value) return null;

  const cleanValue = value.toUpperCase().trim();
  const match = cleanValue.match(/(\d+(?:[.,]\d+)?)\s*(TB|GB|MB)?/);

  if (!match) return null;

  const num = parseFloat(match[1].replace(',', '.'));
  const unit = match[2] || 'GB';

  if (unit === 'TB') return num * 1024;
  if (unit === 'GB') return num;
  if (unit === 'MB') return num / 1024;

  return num;
}
