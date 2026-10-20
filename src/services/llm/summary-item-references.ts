import { GeneratedPaperSummary } from '../../types/index.js';

const ORDINAL =
  '(?:erste|zweite|dritte|vierte|fünfte|sechste|siebte|achte|neunte|zehnte|letzte)[nrs]?\\s+(?:beiden\\s+)?';
const ITEM_NUMBER = '\\s*\\d+[a-z]?(?:\\s*(?:,|und|oder|bis|sowie|–|-)\\s*\\d+[a-z]?)*\\b';

// A numbered part of the original paper, named by its number or position instead
// of by what it says. `Ziffer`/`Antragspunkt`/`Beschlusspunkt` are references by
// definition; plain `Punkt` only with a number or an ordinal, so "in diesem Punkt"
// stays legal. `Nr.` is deliberately absent: "Grundstück Nr. 1551" and
// "Bebauungsplan Nr. 769" are identifiers the reader can look up.
const ITEM_REFERENCE = new RegExp(
  [
    `\\b(?:${ORDINAL})?(?:Beschluss|Antrags)?(?:ziffer|punkt)(?:e|en|n)?\\b(?:${ITEM_NUMBER})?`,
    `\\b(?:${ORDINAL})?Ziffern?\\b(?:${ITEM_NUMBER})?`,
    `\\bZiff\\.${ITEM_NUMBER}`,
    `\\b${ORDINAL}Punkte?\\b`,
    `\\bPunkte?${ITEM_NUMBER}`,
  ].join('|'),
  'giu',
);

// "§ 11 Abs. 5 Ziff. 1" and "§ 74 Absatz 2 Nummer 1 LPVG" cite a statute, which
// the reader can look up; those stay.
const LEGAL_CITATION_BEFORE = /(?:§|Art\.|Artikel|Abs\.|Absatz)\s*\w*\s*$/u;

/**
 * Return references to numbered parts of the original paper ("die Ziffern 1 und
 * 3", "den ersten Punkt", "zwei der drei Antragspunkte"). The reader has only the
 * summary, whose only numbering is its own key point list, so such a reference is
 * either unresolvable or silently read as pointing at the wrong key point.
 */
export function findItemReferences(generated: GeneratedPaperSummary): string[] {
  const generatedText = [generated.summary, ...generated.keyPoints].join('\n');
  const references: string[] = [];
  for (const match of generatedText.matchAll(ITEM_REFERENCE)) {
    const reference = match[0].trim();
    // The first alternative also matches a bare `Punkt`, which alone is prose
    // ("bei allen Punkten", "mit 443 Punkten").
    if (/^punkt(?:e|en)?$/iu.test(reference)) continue;
    const before = generatedText.slice(Math.max(0, match.index - 25), match.index);
    if (LEGAL_CITATION_BEFORE.test(before)) continue;
    references.push(reference);
  }
  return [...new Set(references)];
}
