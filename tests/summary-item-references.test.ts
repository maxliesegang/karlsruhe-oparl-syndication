import { describe, expect, it } from 'vitest';
import { findItemReferences } from '../src/services/llm/summary-item-references.js';

describe('summary item references', () => {
  // papers/54720, reported by a reader: "Ziffer 1 und 3" read as the first and
  // third key point listed directly below, which say something else.
  it('finds numbered Ziffern from a real published summary', () => {
    expect(
      findItemReferences({
        summary:
          'Die Verwaltung empfiehlt, die Ziffern 1 und 3 als erledigt zu betrachten und Ziffer 2 abzulehnen.',
        keyPoints: ['Die Verwaltung hält die vier ergänzenden Ziffern 6 bis 9 für verfrüht.'],
      }),
    ).toEqual(['Ziffern 1 und 3', 'Ziffer 2', 'Ziffern 6 bis 9']);
  });

  it('finds items referenced by position instead of number', () => {
    expect(
      findItemReferences({
        summary:
          'Sie empfiehlt, den ersten Punkt als erledigt zu betrachten und zwei der drei Antragspunkte abzulehnen.',
        keyPoints: ['Die ersten beiden Punkte hält sie für nicht finanzierbar (Antragspunkt 2).'],
      }),
    ).toEqual(['ersten Punkt', 'Antragspunkte', 'ersten beiden Punkte', 'Antragspunkt 2']);
  });

  it('leaves statute citations, identifiers and ordinary prose alone', () => {
    expect(
      findItemReferences({
        summary:
          'Konkret soll § 11 Abs. 5 Ziff. 1 ergänzt werden; die Befreiung von § 1 Abs. 3 Nr. 7 GemHVO bleibt.',
        keyPoints: [
          'Verkauft wird das Grundstück Nr. 1551 laut Bebauungsplan Nr. 769.',
          'Die IABG erreichte mit 443 Punkten das beste Ergebnis; in diesem Punkt bleibt es offen.',
          'Der Zeitpunkt und die Schwerpunkte sind beziffert.',
        ],
      }),
    ).toEqual([]);
  });
});
