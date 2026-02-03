import { isGraphicsCardMatch } from '../matchers/graphicsCardMatcher';

describe('graphicsCardMatcher.isGraphicsCardMatch', () => {
  it('returns true when watched is empty or null (no requirement)', () => {
    expect(isGraphicsCardMatch('Intel UHD', undefined)).toBe(true);
    expect(isGraphicsCardMatch('Intel UHD', null)).toBe(true);
    expect(isGraphicsCardMatch('Intel UHD', '')).toBe(true);
    expect(isGraphicsCardMatch(undefined, '')).toBe(true);
  });

  it('returns false when laptop has no card but watched requires one', () => {
    expect(isGraphicsCardMatch(undefined, 'NVIDIA RTX')).toBe(false);
    expect(isGraphicsCardMatch('', 'NVIDIA RTX')).toBe(false);
  });

  it('matches exact same card (case insensitive)', () => {
    expect(isGraphicsCardMatch('NVIDIA RTX 3060', 'NVIDIA RTX 3060')).toBe(true);
    expect(isGraphicsCardMatch('intel iris xe', 'Intel Iris Xe')).toBe(true);
  });

  it('matches when laptop includes watched card name (shorthand)', () => {
    expect(isGraphicsCardMatch('NVIDIA GeForce RTX 3060', 'RTX 3060')).toBe(true);
    expect(isGraphicsCardMatch('NVIDIA GeForce RTX 3060', '3060')).toBe(true);
    expect(isGraphicsCardMatch('AMD Radeon RX 6600', 'RX 6600')).toBe(true);
  });

  it('matches when watched includes laptop (substring)', () => {
    expect(isGraphicsCardMatch('Iris Xe', 'Intel Iris Xe Graphics')).toBe(true);
  });

  it('matches by words (all watched words in laptop)', () => {
    expect(isGraphicsCardMatch('Intel Iris Xe Graphics', 'Iris Xe')).toBe(true);
  });

  it('returns false when card does not match', () => {
    expect(isGraphicsCardMatch('Intel UHD 620', 'NVIDIA RTX 3060')).toBe(false);
  });

  it('matches when laptop matches any of multiple options (OR)', () => {
    expect(
      isGraphicsCardMatch('NVIDIA RTX 3060', 'AMD RX 6600, NVIDIA RTX 3060, Intel Iris')
    ).toBe(true);
    expect(
      isGraphicsCardMatch('Intel Iris Xe', 'AMD RX 6600, NVIDIA RTX 3060, Intel Iris Xe')
    ).toBe(true);
    expect(
      isGraphicsCardMatch('AMD Radeon RX 6600', 'NVIDIA RTX 3060, AMD RX 6600')
    ).toBe(true);
  });

  it('returns false when laptop matches none of multiple options', () => {
    expect(
      isGraphicsCardMatch('Intel UHD 620', 'NVIDIA RTX 3060, AMD RX 6600')
    ).toBe(false);
  });

  it('accepts newline as separator', () => {
    expect(
      isGraphicsCardMatch('NVIDIA RTX 3060', 'AMD RX 6600\nNVIDIA RTX 3060')
    ).toBe(true);
  });

  it('matches with one typo in mail (e.g. rtc vs RTX)', () => {
    expect(isGraphicsCardMatch('NVIDIA GeForce rtc 3060', 'RTX 3060')).toBe(true);
    expect(isGraphicsCardMatch('NVIDIA rtx 3060', 'rtc 3060')).toBe(true);
    expect(isGraphicsCardMatch('AMD Radcon RX 6600', 'Radeon RX 6600')).toBe(true);
  });

  it('matches one wrong digit in model number (e.g. 3061 vs 3060)', () => {
    expect(isGraphicsCardMatch('NVIDIA GeForce RTX 3061', 'RTX 3060')).toBe(true);
    expect(isGraphicsCardMatch('NVIDIA GeForce RTX 3060', 'RTX 3061')).toBe(true);
    expect(isGraphicsCardMatch('AMD RX 6601', 'RX 6600')).toBe(true);
  });

  it('does not match when typo is too large (2+ chars)', () => {
    expect(isGraphicsCardMatch('NVIDIA GeForce rab 3060', 'RTX 3060')).toBe(false);
  });
});
