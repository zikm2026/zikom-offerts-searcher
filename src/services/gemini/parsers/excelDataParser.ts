import { ExcelData, LaptopSpec } from '../../../types/email';
import logger from '../../../utils/logger';
import { normalizePriceFromGemini, applyTotalPriceFallback } from './priceUtils';

interface RawLaptop {
  model?: string;
  ram?: string;
  storage?: string;
  price?: unknown;
  graphicsCard?: string;
}

interface RawExcelResponse {
  laptops?: RawLaptop[];
  grade?: string;
  totalPrice?: unknown;
  totalQuantity?: number;
}

function parseLaptopsArray(parsed: RawExcelResponse): LaptopSpec[] {
  return (parsed.laptops || []).map((laptop: RawLaptop) => ({
    model: laptop.model || undefined,
    ram: laptop.ram || undefined,
    storage: laptop.storage || undefined,
    price: normalizePriceFromGemini(laptop.price),
    graphicsCard: laptop.graphicsCard || undefined,
  }));
}

export function parseExcelResponse(text: string, logLabel: string = 'Gemini'): ExcelData {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Gemini response');
    }

    const parsed: RawExcelResponse = JSON.parse(jsonMatch[0]);
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
