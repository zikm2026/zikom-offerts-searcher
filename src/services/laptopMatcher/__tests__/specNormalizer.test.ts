import { normalizeToGB } from '../normalizers/specNormalizer';

describe('specNormalizer.normalizeToGB', () => {
  it('returns null for undefined or empty', () => {
    expect(normalizeToGB(undefined)).toBeNull();
    expect(normalizeToGB('')).toBeNull();
  });

  it('parses GB values', () => {
    expect(normalizeToGB('8 GB')).toBe(8);
    expect(normalizeToGB('16GB')).toBe(16);
    expect(normalizeToGB('32 gb')).toBe(32);
    expect(normalizeToGB('256')).toBe(256); // default unit GB
  });

  it('parses TB values (converts to GB)', () => {
    expect(normalizeToGB('1 TB')).toBe(1024);
    expect(normalizeToGB('2TB')).toBe(2048);
  });

  it('parses MB values (converts to GB)', () => {
    expect(normalizeToGB('512 MB')).toBe(512 / 1024);
  });

  it('handles comma as decimal separator', () => {
    expect(normalizeToGB('1,5 TB')).toBe(1.5 * 1024);
  });

  it('returns null for invalid input', () => {
    expect(normalizeToGB('no number')).toBeNull();
    expect(normalizeToGB('abc')).toBeNull();
  });
});
