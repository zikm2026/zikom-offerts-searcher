import { prepareEmailContent } from '../content/emailContentPreparer';

describe('emailContentPreparer.prepareEmailContent', () => {
  const baseEmail = {
    uid: 1,
    from: 'sender@test.com',
    subject: 'Offer',
    date: new Date('2025-01-01T12:00:00Z'),
  };

  it('includes From, Subject, Date', () => {
    const email = { ...baseEmail, text: 'Hello' };
    const result = prepareEmailContent(email, 100);
    expect(result).toContain('From: sender@test.com');
    expect(result).toContain('Subject: Offer');
    expect(result).toContain('Date: 2025-01-01');
  });

  it('uses text when only text provided', () => {
    const email = { ...baseEmail, text: 'Full body text here' };
    const result = prepareEmailContent(email, 100);
    expect(result).toContain('Text Content: Full body text here');
  });

  it('truncates text to maxLength', () => {
    const long = 'a'.repeat(300);
    const email = { ...baseEmail, text: long };
    const result = prepareEmailContent(email, 50);
    expect(result).toContain('a'.repeat(50));
  });

  it('when forParsingLaptops sends single body block (prefer longer of text vs html)', () => {
    const email = {
      ...baseEmail,
      text: 'Text part',
      html: '<p>HTML part</p>',
    };
    const result = prepareEmailContent(email, 100, true);
    expect(result).toContain('Treść:');
    expect(result).toContain('Text part');
  });
});
