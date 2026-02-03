import { isModelMatch } from '../matchers/modelMatcher';

describe('modelMatcher.isModelMatch', () => {
  it('returns false when laptopModel is undefined or empty', () => {
    expect(isModelMatch(undefined, 'Dell Latitude')).toBe(false);
    expect(isModelMatch('', 'Dell Latitude')).toBe(false);
  });

  it('matches exact same model (case insensitive)', () => {
    expect(isModelMatch('Dell Latitude 7430', 'Dell Latitude 7430')).toBe(true);
    expect(isModelMatch('DELL LATITUDE 7430', 'dell latitude 7430')).toBe(true);
  });

  it('matches when laptop includes watched model', () => {
    expect(isModelMatch('Dell Latitude 7430 14"', 'Dell Latitude 7430')).toBe(true);
  });

  it('matches when watched includes laptop (shorter laptop name)', () => {
    expect(isModelMatch('Latitude 7430', 'Dell Latitude 7430')).toBe(true);
  });

  it('matches by words (all watched words appear in laptop)', () => {
    expect(isModelMatch('Dell Latitude 7430', 'Latitude 7430')).toBe(true);
    expect(isModelMatch('HP EliteBook 840 G8', 'EliteBook 840')).toBe(true);
  });

  it('returns false when model does not match', () => {
    expect(isModelMatch('Lenovo ThinkPad X1', 'Dell Latitude')).toBe(false);
    expect(isModelMatch('HP EliteBook', 'Dell Latitude 7430')).toBe(false);
  });
});
