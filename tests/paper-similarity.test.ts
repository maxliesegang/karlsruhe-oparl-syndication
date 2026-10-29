import { describe, expect, it } from 'vitest';
import {
  buildPaperSimilarityText,
  SIMILARITY_BODY_CHARACTER_LIMIT,
  findSimilarPapers,
  SimilarityDocument,
  tokenizeForSimilarity,
} from '../src/paper-similarity.js';
import { stripSimilarityBoilerplate } from '../src/services/paper-similarity-source.js';
import type { OParlFile, Paper } from '../src/types/index.js';

/** Enough unrelated filler that the topical terms stay under the 10% document cap. */
const FILLER: SimilarityDocument[] = Array.from({ length: 40 }, (_, index) => ({
  id: `filler-${String(index).padStart(2, '0')}`,
  text: `Thema${'x'.repeat(index + 1)} Bericht${'y'.repeat(index + 1)}`,
}));

const OPTIONS = { maximumNeighborCount: 5, minimumScore: 0 };

describe('tokenizeForSimilarity', () => {
  it('drops digits, short words and stopwords', () => {
    expect(tokenizeForSimilarity('Die Stadthalle wird 2026/0123 für 12,5 Mio. € saniert')).toEqual([
      'stadthalle',
      'mio',
      'saniert',
    ]);
  });
});

describe('buildPaperSimilarityText', () => {
  it('uses the title and own attachments, never minutes', () => {
    const paper = {
      name: 'Umfahrung Hagsfeld',
      auxiliaryFile: [
        { id: 'own', name: 'Vorlage' },
        { id: 'minutes', name: 'Protokoll GR TOP 9' },
      ] as OParlFile[],
    } as Paper;
    const texts: Record<string, string> = { own: 'Trassenvarianten', minutes: 'Bekanntgaben' };

    const text = buildPaperSimilarityText(paper, (file) => texts[file.id]);

    expect(text).toContain('Umfahrung Hagsfeld');
    expect(text).toContain('Trassenvarianten');
    expect(text).not.toContain('Bekanntgaben');
  });

  it('keeps a substantive proposal ahead of a long annex regardless of API ordering', () => {
    const files = [
      { id: '1', name: 'Satzungsbeschluss Anlage 1_Synopse_Offenlage' },
      { id: '3', name: 'Satzungsbeschluss KIT Campus Ost' },
      { id: '2', name: 'Umweltbericht' },
    ] as OParlFile[];
    const paper = { name: 'Campus Ost', auxiliaryFile: files } as Paper;
    const texts: Record<string, string> = {
      '1': 'SYNOPSE '.repeat(1000),
      '2': 'UMWELT '.repeat(1000),
      '3': 'FORSCHUNGSLABOR '.repeat(400),
    };
    const text = buildPaperSimilarityText(paper, (file) => texts[file.id]);
    expect(text).toBe(
      buildPaperSimilarityText(
        { ...paper, auxiliaryFile: [...files].reverse() },
        (file) => texts[file.id],
      ),
    );
    expect(text).toMatch(/^Campus Ost\nFORSCHUNGSLABOR/);
    expect(text).toContain('SYNOPSE');
    expect(text.slice('Campus Ost\n'.length).length).toBeLessThanOrEqual(
      SIMILARITY_BODY_CHARACTER_LIMIT,
    );
    expect(paper.auxiliaryFile[0].id).toBe('1');
  });

  it('keeps annex-only evidence when the proposal is missing or its extraction is unusable', () => {
    const paper = {
      name: 'Park',
      auxiliaryFile: [
        { id: 'proposal', name: 'Beschlussvorlage' },
        { id: 'annex', name: 'Anlage Lageplan' },
      ] as OParlFile[],
    } as Paper;
    expect(
      buildPaperSimilarityText(paper, (file) =>
        file.id === 'proposal' ? '☒ ☐ ' : 'Standort der Skateanlage',
      ),
    ).toContain('Standort der Skateanlage');
    expect(buildPaperSimilarityText(paper, () => undefined)).toBe('Park\n');
  });
});

describe('similarity-only budget cleanup', () => {
  it.each(['\uF075', '►', 'X'])(
    'gets to the motion beyond the %s form and omits the faction signature',
    (bullet) => {
      const text =
        `Faction letterhead\nLighting\n${bullet} Zuordnung im Haushaltsplan\n` +
        'Bitte aus Liste auswählen\n'.repeat(150) +
        `Fehler! Verweisquelle konnte nicht gefunden werden.\n${bullet} Sachverhalt | Begründung\n` +
        'Keep 3.000 Euro for lighting at the Calisthenics-Anlage.\nUnterzeichnet von:\nSame faction';
      expect(stripSimilarityBoilerplate(text)).toBe(
        'Keep 3.000 Euro for lighting at the Calisthenics-Anlage.',
      );
      const paper = {
        name: 'Lighting',
        auxiliaryFile: [{ id: 'a', name: 'Antrag' }] as OParlFile[],
      } as Paper;
      expect(buildPaperSimilarityText(paper, () => text)).toContain('Calisthenics-Anlage');
      expect(buildPaperSimilarityText(paper, () => text)).not.toContain('Faction');
    },
  );

  it('does not discard content without both exact budget-form boundaries', () => {
    expect(
      stripSimilarityBoilerplate('Budget planning\nSachverhalt | Begründung\nKeep the park.'),
    ).toContain('Budget planning');
    expect(
      stripSimilarityBoilerplate('Zuordnung im Haushaltsplan\nA table without a recognised end.'),
    ).toContain('A table without a recognised end.');
  });
});

describe('findSimilarPapers', () => {
  const documents: SimilarityDocument[] = [
    { id: 'a', text: 'Stadthalle Sanierung Brandschutz Bühnentechnik' },
    { id: 'b', text: 'Stadthalle Sanierung Brandschutz' },
    { id: 'c', text: 'Stadthalle Kongress' },
    { id: 'd', text: 'Radweg Hagsfeld Umfahrung' },
    ...FILLER,
  ];

  it('ranks by shared vocabulary, best first', () => {
    const similar = findSimilarPapers(documents, OPTIONS);

    expect(similar.get('a')?.map((paper) => paper.id)).toEqual(['b', 'c']);
    expect(similar.get('d')).toBeUndefined();
  });

  it('applies the minimum score, the neighbour cap and the exclusion', () => {
    const scores = findSimilarPapers(documents, OPTIONS).get('a')!;

    expect(
      findSimilarPapers(documents, { ...OPTIONS, minimumScore: scores[0].score }).get('a'),
    ).toEqual([scores[0]]);
    expect(findSimilarPapers(documents, { ...OPTIONS, maximumNeighborCount: 1 }).get('a')).toEqual([
      scores[0],
    ]);
    expect(
      findSimilarPapers(documents, {
        ...OPTIONS,
        isExcluded: (id, otherId) => id === 'a' && otherId === 'b',
      })
        .get('a')
        ?.map((paper) => paper.id),
    ).toEqual(['c']);
  });

  it('does not depend on input order, and breaks ties on id', () => {
    const tied: SimilarityDocument[] = [
      { id: 'q', text: 'Stadthalle' },
      { id: 'z', text: 'Stadthalle' },
      { id: 'm', text: 'Stadthalle' },
      ...FILLER,
    ];

    const forward = findSimilarPapers(tied, OPTIONS);
    const reversed = findSimilarPapers([...tied].reverse(), OPTIONS);

    expect(reversed).toEqual(forward);
    expect(forward.get('q')?.map((paper) => paper.id)).toEqual(['m', 'z']);
    expect(findSimilarPapers(tied, { ...OPTIONS, maximumNeighborCount: 1 }).get('z')).toEqual([
      { id: 'm', score: forward.get('z')![0].score },
    ]);
  });

  it('keeps the strongest member of each family and fills the remaining slots', () => {
    const similar = findSimilarPapers(documents, {
      ...OPTIONS,
      maximumNeighborCount: 2,
      familyOf: (id) => (id === 'b' || id === 'c' ? 'same-family' : id),
    });
    expect(similar.get('a')?.map((item) => item.id)).toEqual(['b']);
    expect(
      findSimilarPapers([...documents].reverse(), {
        ...OPTIONS,
        maximumNeighborCount: 2,
        familyOf: (id) => (id === 'b' || id === 'c' ? 'same-family' : id),
      }),
    ).toEqual(similar);
  });
});
