import { describe, expect, it } from 'vitest';
import { normalizeOParlUrl, isRecentFile, latestValidDate, parseValidDate } from '../src/utils.js';

describe('normalizeOParlUrl', () => {
  it('adds the RIS path to legacy OParl URLs', () => {
    expect(normalizeOParlUrl('https://example.test/oparl/bodies/1')).toBe(
      'https://example.test/ris/oparl/bodies/1',
    );
  });

  it('leaves corrected URLs unchanged', () => {
    const url = 'https://example.test/ris/oparl/bodies/1';
    expect(normalizeOParlUrl(url)).toBe(url);
  });
});

describe('parseValidDate', () => {
  it('parses valid ISO strings', () => {
    expect(parseValidDate('2026-07-18T12:00:00Z')?.toISOString()).toBe('2026-07-18T12:00:00.000Z');
  });

  it('returns undefined for missing or malformed dates', () => {
    expect(parseValidDate(undefined)).toBeUndefined();
    expect(parseValidDate(null)).toBeUndefined();
    expect(parseValidDate('')).toBeUndefined();
    expect(parseValidDate('not-a-date')).toBeUndefined();
  });
});

describe('latestValidDate', () => {
  it('returns the most recent valid date, ignoring invalid ones', () => {
    const result = latestValidDate('2020-01-01', 'garbage', undefined, '2026-07-18T00:00:00Z');
    expect(result?.toISOString()).toBe('2026-07-18T00:00:00.000Z');
  });

  it('returns undefined when no valid date is present', () => {
    expect(latestValidDate(undefined, null, 'nope')).toBeUndefined();
  });
});

describe('isRecentFile', () => {
  it('accepts the current year and the preceding two years', () => {
    const year = new Date().getFullYear();

    expect(isRecentFile(`${year}-01-01`)).toBe(true);
    expect(isRecentFile(`${year - 2}-12-31`)).toBe(true);
    expect(isRecentFile(`${year - 3}-12-31`)).toBe(false);
  });
});
