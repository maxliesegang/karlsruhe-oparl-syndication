import { describe, expect, it } from 'vitest';
import { normalizeOParlUrl } from '../src/oparl-url.js';

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
