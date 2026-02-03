import { LaptopSpec } from '../../../types/email';
import logger from '../../../utils/logger';

export function fillMissingFromEmailText(laptops: LaptopSpec[], rawText: string): void {
  if (!rawText || laptops.length === 0) return;

  const text = rawText.replace(/\s+/g, ' ');

  const priceNettoMatch = text.match(/(\d[\d\s]*)\s*zł\s*netto/i);
  const priceAnyMatch = text.match(/(\d[\d\s]*)\s*zł/i);
  let priceStr: string | undefined;
  if (priceNettoMatch) {
    priceStr =
      priceNettoMatch[1].replace(/\s/g, '').replace('.', ',').replace(/,$/, '') + ',00 PLN';
  } else if (priceAnyMatch) {
    priceStr = priceAnyMatch[1].replace(/\s/g, '').replace('.', ',').replace(/,$/, '') + ',00 PLN';
  }
  const eurMatch = text.match(/(\d[\d\s.,]*)\s*[€EUR]/i);
  if (!priceStr && eurMatch) {
    priceStr = eurMatch[1].replace(/\s/g, '').replace(',', '.') + ' EUR';
  }

  const ramMatch =
    text.match(/(\d+)\s*GB\s*RAM/i) || text.match(/\|\s*(\d+)GB\s*\|/i) || text.match(/(\d+)\s*GB\s*\|/);
  const ramStr = ramMatch ? `${ramMatch[1]} GB` : undefined;

  const storageNvme = text.match(/(\d+)\s*GB\s*SSD\s*NVMe/i);
  const storageTb = text.match(/(\d+)\s*TB/i);
  const storageGb = text.match(/(\d+)\s*GB\s*SSD/i) || text.match(/(\d+)\s*GB\s*NVMe/i);
  let storageStr: string | undefined;
  if (storageNvme) storageStr = `${storageNvme[1]} GB SSD NVMe`;
  else if (storageTb) storageStr = `${storageTb[1]} TB`;
  else if (storageGb) storageStr = `${storageGb[1]} GB`;

  const gfxMatch = text.match(
    /(Intel\s+UHD|Iris\s*Xe|NVIDIA\s+[A-Z0-9\s]+|AMD\s+Radeon\s+[A-Z0-9\s]+|UHD\s+Graphics\s*\d*)/i
  );
  const gfxStr = gfxMatch ? gfxMatch[1].trim() : undefined;

  let filled = 0;
  laptops.forEach((l) => {
    if (!l.price && priceStr) {
      l.price = priceStr;
      filled++;
    }
    if (!l.ram && ramStr) {
      l.ram = ramStr;
      filled++;
    }
    if (!l.storage && storageStr) {
      l.storage = storageStr;
      filled++;
    }
    if (!l.graphicsCard && gfxStr) {
      l.graphicsCard = gfxStr;
      filled++;
    }
  });

  if (filled > 0) {
    logger.debug(`📊 Uzupełniono ${filled} pól z treści maila (regex fallback)`);
  }
}
