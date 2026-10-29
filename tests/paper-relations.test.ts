import { describe, expect, it } from 'vitest';
import {
  buildPaperRelations,
  findCitedReferences,
  normalizePaperTitle,
} from '../src/paper-relations.js';
import type { OParlFile, Paper } from '../src/types/index.js';

const PAPER_BASE = 'https://web2.karlsruhe.de/ris/oparl/bodies/0001/papers/vo/';

function buildPaper(recordId: string, overrides: Partial<Paper> = {}): Paper {
  return {
    id: `${PAPER_BASE}${recordId}`,
    type: 'https://schema.oparl.org/1.1/Paper',
    body: 'https://web2.karlsruhe.de/ris/oparl/bodies/0001',
    name: `Vorlage ${recordId}`,
    reference: `2026/${recordId.padStart(4, '0')}`,
    date: '2026-03-01',
    paperType: 'Beschlussvorlage',
    auxiliaryFile: [],
    underDirectionOf: [],
    consultation: [],
    created: '2026-03-01T00:00:00+01:00',
    modified: '2026-03-01T00:00:00+01:00',
    ...overrides,
  };
}

function attachment(id: string, name: string): OParlFile {
  return { id, name } as OParlFile;
}

function relationsOf(papers: Paper[], texts: Record<string, string> = {}) {
  return buildPaperRelations(papers, (file) => texts[file.id]);
}

describe('findCitedReferences', () => {
  it('finds references with and without a motion suffix', () => {
    expect(
      findCitedReferences(
        'siehe Vorlage Nr. 2013/0262 und den Antrag 2021/0167/1 sowie DHH/2024/0012',
      ),
    ).toEqual(['2013/0262', '2021/0167/1', '2021/0167', 'DHH/2024/0012']);
  });

  it('skips year ranges, which are also valid reference numbers', () => {
    // 2023 ran to 2502 papers, so 2023/2024 exists — but here it names a budget.
    expect(findCitedReferences('Doppelhaushalt 2023/2024')).toEqual([]);
  });

  it('does not read a reference out of a prefixed one', () => {
    // BV/2022/2026 is a paper's own number; 2022/2026 is an unrelated paper.
    expect(findCitedReferences('Vorlage BV/2022/2026')).toEqual([]);
  });
});

describe('normalizePaperTitle', () => {
  it('ignores case, punctuation and the submitter prefix of a motion', () => {
    expect(normalizePaperTitle('Antrag GRÜNE: Umfahrung Hagsfeld')).toBe(
      normalizePaperTitle('Umfahrung  Hagsfeld.'),
    );
  });

  it('drops titles that recur without denoting one matter', () => {
    expect(normalizePaperTitle('Bekanntgaben')).toBeUndefined();
    expect(normalizePaperTitle('Anfragen und Anregungen aus dem Ortschaftsrat')).toBeUndefined();
    expect(
      normalizePaperTitle('Annahme des Angebots von Zuwendungen: a) allgemeine Zuwendungen'),
    ).toBeUndefined();
    expect(normalizePaperTitle('')).toBeUndefined();
  });

  it('keeps a recurring statute, whose amendments are one history', () => {
    expect(normalizePaperTitle('Satzung zur Änderung der Hauptsatzung')).toBe(
      'satzung zur änderung der hauptsatzung',
    );
  });
});

describe('buildPaperRelations', () => {
  it('stores a citation from both sides with the inverse kind', () => {
    const citing = buildPaper('2', {
      auxiliaryFile: [attachment('f2', 'Stellungnahme')],
    });
    const cited = buildPaper('1');

    const relations = relationsOf([citing, cited], { f2: 'vgl. Vorlage Nr. 2026/0001' });

    expect(relations.get(citing.id)?.get(cited.id)).toEqual(['cites']);
    expect(relations.get(cited.id)?.get(citing.id)).toEqual(['cited-by']);
  });

  it('never reads citations out of minutes, which list every item of the sitting', () => {
    const paper = buildPaper('2', {
      auxiliaryFile: [attachment('f2', 'Protokoll GR 12.03.2026 TOP 9')],
    });
    const sibling = buildPaper('1');

    expect(relationsOf([paper, sibling], { f2: 'Vorlage: 2026/0001' }).size).toBe(0);
  });

  it('drops a reference that names more than one paper', () => {
    const citing = buildPaper('3', { auxiliaryFile: [attachment('f3', 'Antrag')] });
    const first = buildPaper('1', { reference: '2019/1012' });
    const second = buildPaper('2', { reference: '2019/1012' });

    expect(relationsOf([citing, first, second], { f3: 'Vorlage 2019/1012' }).size).toBe(0);
  });

  it('ignores a paper citing its own reference', () => {
    const paper = buildPaper('1', { auxiliaryFile: [attachment('f1', 'Vorlage')] });

    expect(relationsOf([paper], { f1: 'Vorlage Nr. 2026/0001' }).size).toBe(0);
  });

  it('links a suffixed motion to its Vorlage and copies OParl links verbatim', () => {
    const vorlage = buildPaper('1', { reference: '2021/0167' });
    const motion = buildPaper('2', {
      reference: '2021/0167/1',
      subordinatedPaper: [vorlage.id],
    });

    expect(relationsOf([vorlage, motion]).get(motion.id)?.get(vorlage.id)).toEqual([
      'reference-family',
      'subordinated',
    ]);
  });

  it('chains same-title papers chronologically instead of connecting all of them', () => {
    const papers = ['2024-01-01', '2022-01-01', '2023-01-01'].map((date, index) =>
      buildPaper(String(index + 1), { name: 'Stadthalle Modernisierung', date }),
    );
    const [newest, oldest, middle] = papers;

    const relations = relationsOf(papers);

    expect([...(relations.get(oldest.id)?.keys() ?? [])]).toEqual([middle.id]);
    expect([...(relations.get(middle.id)?.keys() ?? [])].sort()).toEqual(
      [oldest.id, newest.id].sort(),
    );
    expect(relations.get(newest.id)?.get(middle.id)).toEqual(['same-title']);
  });
});
