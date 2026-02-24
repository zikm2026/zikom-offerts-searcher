import { OfferAnalysis, OfferType } from '../../../types/email';
import logger from '../../../utils/logger';

function toOfferType(v: string | null | undefined): OfferType | undefined {
  if (!v) return undefined;
  const t = String(v).toLowerCase();
  if (t === 'laptop') return 'laptop';
  if (t === 'monitor') return 'monitor';
  if (t === 'desktop') return 'desktop';
  return undefined;
}

export function parseOfferAnalysisResponse(response: string): OfferAnalysis {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    let offerType: OfferType | undefined = toOfferType(parsed.offerType);
    if (!offerType && parsed.category) {
      offerType = toOfferType(parsed.category) ?? undefined;
    }

    return {
      isOffer: Boolean(parsed.isOffer),
      confidence: Math.min(Math.max(Number(parsed.confidence) || 0, 0), 100),
      category: parsed.category || undefined,
      offerType: offerType ?? undefined,
      details: {
        productType: parsed.details?.productType || undefined,
        brand: parsed.details?.brand || undefined,
        model: parsed.details?.model || undefined,
        price: parsed.details?.price || undefined,
        discount: parsed.details?.discount || undefined,
        store: parsed.details?.store || undefined,
      },
      reasoning: parsed.reasoning || undefined,
    };
  } catch (error) {
    logger.warn('Failed to parse Gemini response as JSON:', error);
    logger.debug('Raw response:', response);

    const isOfferMatch = /(?:is.*offer|oferta).*?(?:true|tak|yes)/i.test(response);
    const confidenceMatch = response.match(/(?:confidence|pewność).*?(\d+)/i);

    return {
      isOffer: isOfferMatch,
      confidence: confidenceMatch ? parseInt(confidenceMatch[1], 10) : 50,
      offerType: undefined,
      reasoning: 'Parsed from text response due to JSON parsing error',
    };
  }
}
