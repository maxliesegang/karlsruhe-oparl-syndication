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
});
