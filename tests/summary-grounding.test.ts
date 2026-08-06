import { describe, expect, it } from 'vitest';
import { findUngroundedNumericLiterals } from '../src/services/llm/summary-grounding.js';

describe('summary numeric grounding', () => {
  it('rejects a derived total even when its operands occur in the source', () => {
    const ungrounded = findUngroundedNumericLiterals(
      {
        summary: 'Von 2015 bis 2025 gab es insgesamt 7.889 Einbürgerungen.',
        keyPoints: ['Im Jahr 2025 waren es 1.089.'],
      },
      '2015: 799\n2016: 676\n2025: 1.089',
    );

    expect(ungrounded).toEqual(['7.889']);
  });

  it('accepts dates, decimals, and whitespace-grouped values present in the source', () => {
    const ungrounded = findUngroundedNumericLiterals(
      {
        summary: 'Der Vertrag beginnt am 01.09.2026 und kostet 2,5 Millionen Euro.',
        keyPoints: ['Vorgesehen sind 35 000 Euro.'],
      },
      'Beginn: 01.09.2026. Kosten: 2,5 Millionen Euro; Budget: 35\u00a0000 Euro.',
    );

    expect(ungrounded).toEqual([]);
  });

  // Real rejections from the 2026-08-06 run. Every one of these amounts is in
  // the paper's own PDF; only the spelling differs, so grounding must compare
  // values. Under exact-string matching these papers were never summarized.
  it('accepts a source amount respelled without value-less decimals or separators', () => {
    const ungrounded = findUngroundedNumericLiterals(
      {
        summary: 'Der Kaufpreis beträgt 1.860.000 Euro.',
        keyPoints: ['Der Buchwert liegt bei 728.000 Euro.', 'Die Rücklage beträgt 5.000 Euro.'],
      },
      'Kaufpreis 1.860.000,00 Euro; Buchwert 728.000,00 Euro; Rücklage 5000 Euro.',
    );

    expect(ungrounded).toEqual([]);
  });

  it('accepts a source date written back in German prose', () => {
    const ungrounded = findUngroundedNumericLiterals(
      { summary: 'Die Betriebsleitung ist bis zum 31. Mai 2027 bestellt.', keyPoints: [] },
      'Bestellung befristet bis 31.05.2027.',
    );

    expect(ungrounded).toEqual([]);
  });

  it('still rejects an amount converted to millions', () => {
    const ungrounded = findUngroundedNumericLiterals(
      { summary: 'Die Kosten betragen 21,24 Millionen Euro.', keyPoints: [] },
      'Gesamtkosten: 21.240.000 Euro.',
    );

    expect(ungrounded).toEqual(['21,24']);
  });
});
