import { describe, expect, it } from 'vitest';
import { correctUrl, isRecentFile } from '../src/utils.js';

describe('correctUrl', () => {
  it('adds the RIS path to legacy OParl URLs', () => {
    expect(correctUrl('https://example.test/oparl/bodies/1')).toBe(
      'https://example.test/ris/oparl/bodies/1',
    );
  });

  it('leaves corrected URLs unchanged', () => {
    const url = 'https://example.test/ris/oparl/bodies/1';
    expect(correctUrl(url)).toBe(url);
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
