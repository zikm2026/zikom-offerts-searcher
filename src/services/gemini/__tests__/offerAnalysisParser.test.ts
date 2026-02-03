import { parseOfferAnalysisResponse } from '../parsers/offerAnalysisParser';

describe('offerAnalysisParser.parseOfferAnalysisResponse', () => {
  it('parses valid JSON response', () => {
    const response = `{
      "isOffer": true,
      "confidence": 85,
      "category": "laptop",
      "details": { "productType": "laptop", "store": "CHG" },
      "reasoning": "Test"
    }`;
    const result = parseOfferAnalysisResponse(response);
    expect(result.isOffer).toBe(true);
    expect(result.confidence).toBe(85);
    expect(result.category).toBe('laptop');
    expect(result.details?.store).toBe('CHG');
    expect(result.reasoning).toBe('Test');
  });

  it('extracts JSON from markdown/code block', () => {
    const response = 'Some text ```json\n{"isOffer": false, "confidence": 30}\n```';
    const result = parseOfferAnalysisResponse(response);
    expect(result.isOffer).toBe(false);
    expect(result.confidence).toBe(30);
  });

  it('clamps confidence to 0-100', () => {
    const response = '{"isOffer": true, "confidence": 150}';
    const result = parseOfferAnalysisResponse(response);
    expect(result.confidence).toBe(100);
  });

  it('falls back to regex when JSON invalid', () => {
    const response = 'This is an offer. Confidence: 75. isOffer: true';
    const result = parseOfferAnalysisResponse(response);
    expect(result.isOffer).toBe(true);
    expect(result.confidence).toBe(75);
    expect(result.reasoning).toContain('Parsed from text');
  });

  it('returns isOffer false when no offer keywords', () => {
    const response = 'No match here. Confidence: 10';
    const result = parseOfferAnalysisResponse(response);
    expect(result.isOffer).toBe(false);
    expect(result.confidence).toBe(10);
  });
});
