import { ExcelData, LaptopSpec } from '../../../types/email';
import logger from '../../../utils/logger';
import { normalizePriceFromGemini, applyTotalPriceFallback } from './priceUtils';

interface RawLaptop {
  model?: string;
  ram?: string;
  storage?: string;
  price?: unknown;
  graphicsCard?: string;
  amount?: number;
}

interface RawExcelResponse {
  laptops?: RawLaptop[];
  grade?: string;
  totalPrice?: unknown;
  totalQuantity?: number;
}

function tryRepairTruncatedJson(jsonStr: string): string {
  let s = jsonStr.trim();
  s = s.replace(/,(\s*[\]}])/g, '$1');
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') stack.pop();
  }
  return s + stack.reverse().join('');
}

function parseLaptopsArray(parsed: RawExcelResponse): LaptopSpec[] {
  return (parsed.laptops || []).map((laptop: RawLaptop) => ({
    model: laptop.model || undefined,
    ram: laptop.ram || undefined,
    storage: laptop.storage || undefined,
    price: normalizePriceFromGemini(laptop.price),
    graphicsCard: laptop.graphicsCard || undefined,
    amount: typeof laptop.amount === 'number' && laptop.amount > 0 ? laptop.amount : undefined,
  }));
}

export function parseExcelResponse(text: string, logLabel: string = 'Gemini'): ExcelData {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Gemini response');
    }

    let jsonStr = jsonMatch[0];
    let parsed: RawExcelResponse;
    try {
      parsed = JSON.parse(jsonStr) as RawExcelResponse;
    } catch {
      jsonStr = tryRepairTruncatedJson(jsonStr);
      try {
        parsed = JSON.parse(jsonStr) as RawExcelResponse;
        logger.warn('Odpowiedź Gemini była ucięta lub zepsuta – naprawiono JSON i kontynuowano.');
      } catch {
        throw new Error('Invalid JSON (repair failed)');
      }
    }
    const laptops = parseLaptopsArray(parsed);
    const totalPrice = normalizePriceFromGemini(parsed.totalPrice);
    const totalQuantity = Math.max(0, Number(parsed.totalQuantity) || laptops.length);

    applyTotalPriceFallback(laptops, totalPrice, totalQuantity);

    logger.info(`✅ ${logLabel} wyciągnęło ${laptops.length} laptopów`);

    return {
      laptops,
      totalPrice: totalPrice || undefined,
      totalQuantity: totalQuantity || laptops.length,
      grade: parsed.grade || undefined,
    };
  } catch (error) {
    logger.error('Failed to parse Gemini Excel response:', error);
    const excerpt = text.length > 200 ? `${text.slice(-200)}...` : text;
    logger.error(`Response excerpt (end): ${excerpt}`);
    if (text.trimEnd().endsWith('"') || /,\s*$/.test(text.trimEnd())) {
      logger.warn('Odpowiedź Gemini mogła zostać ucięta (limit tokenów). Zwiększ maxOutputTokens lub skróć treść maila.');
    }

    return {
      laptops: [],
      totalQuantity: 0,
    };
  }
}

export function parseEmailContentResponse(text: string): ExcelData {
  return parseExcelResponse(text, 'Gemini (treść maila)');
}
