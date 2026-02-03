import { EmailMessage, OfferAnalysis } from '../../../types/email';

const LAPTOP_KEYWORDS = [
  'laptop',
  'notebook',
  'ultrabook',
  'macbook',
  'thinkpad',
  'dell',
  'hp',
  'lenovo',
  'asus',
  'acer',
  'msi',
  'komputer',
  'pc',
  'desktop',
  'workstation',
];

const OFFER_KEYWORDS = [
  'promocja',
  'rabat',
  'okazja',
  'wyprzedaż',
  'oferta',
  'cena',
  'zł',
  'pln',
  'euro',
  'taniej',
  'oszczędź',
  'kup',
  'zamów',
  'sklep',
  'allegro',
  'ceneo',
];

export function fallbackOfferAnalysis(email: EmailMessage): OfferAnalysis {
  const content = `${email.subject} ${email.from} ${email.text || ''}`.toLowerCase();

  const laptopScore = LAPTOP_KEYWORDS.filter((keyword) => content.includes(keyword)).length;
  const offerScore = OFFER_KEYWORDS.filter((keyword) => content.includes(keyword)).length;

  const isOffer = laptopScore > 0 && offerScore > 0;
  const confidence = Math.min(laptopScore * 20 + offerScore * 15, 100);

  return {
    isOffer,
    confidence,
    category: laptopScore > 0 ? 'laptop' : undefined,
    reasoning: `Fallback analysis: laptop keywords: ${laptopScore}, offer keywords: ${offerScore}`,
  };
}
