import { fallbackOfferAnalysis } from '../fallbacks/fallbackOfferAnalysis';

describe('fallbackOfferAnalysis', () => {
  const baseEmail = {
    uid: 1,
    from: 'test@example.com',
    subject: 'Test',
    date: new Date(),
    text: '',
  };

  it('returns isOffer true when both laptop and offer keywords present', () => {
    const email = {
      ...baseEmail,
      subject: 'Laptop offer',
      text: 'Dell Latitude promocja cena zł',
    };
    const result = fallbackOfferAnalysis(email);
    expect(result.isOffer).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.category).toBe('laptop');
    expect(result.reasoning).toContain('laptop keywords');
  });

  it('returns isOffer false when only laptop keywords', () => {
    const email = { ...baseEmail, subject: 'Dell Latitude', text: 'no price' };
    const result = fallbackOfferAnalysis(email);
    expect(result.isOffer).toBe(false);
  });

  it('returns isOffer false when only offer keywords', () => {
    const email = { ...baseEmail, subject: 'Promocja cena', text: 'rabat' };
    const result = fallbackOfferAnalysis(email);
    expect(result.isOffer).toBe(false);
    expect(result.category).toBeUndefined();
  });

  it('caps confidence at 100', () => {
    const email = {
      ...baseEmail,
      subject: 'laptop notebook dell hp lenovo asus acer msi komputer pc desktop workstation',
      text: 'promocja rabat okazja wyprzedaż oferta cena zł pln euro taniej oszczędź kup zamów sklep allegro ceneo',
    };
    const result = fallbackOfferAnalysis(email);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });
});
