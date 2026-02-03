import { htmlToText } from '../content/htmlCleaner';

describe('htmlCleaner.htmlToText', () => {
  it('strips tags and normalizes spaces', () => {
    expect(htmlToText('<p>Hello</p>')).toBe('Hello');
    expect(htmlToText('<div>  A   B  </div>')).toBe('A B');
  });

  it('replaces br with newline', () => {
    expect(htmlToText('Line1<br>Line2')).toContain('Line1');
    expect(htmlToText('Line1<br/>Line2')).toContain('Line2');
  });

  it('replaces closing p/div/tr with newline', () => {
    const result = htmlToText('<p>Para</p><div>Block</div>');
    expect(result).toContain('Para');
    expect(result).toContain('Block');
  });

  it('truncates to maxLength', () => {
    const long = '<p>' + 'x'.repeat(500) + '</p>';
    expect(htmlToText(long, 50).length).toBe(50);
  });

  it('default maxLength is 2000', () => {
    const result = htmlToText('<p>Short</p>');
    expect(result).toBe('Short');
  });
});
