import { describe, expect, it } from 'vitest';
import {
  findFactionsInText,
  findPaperSubmitters,
  getFactionName,
  isMotionPaper,
  listFactions,
} from '../src/paper-submitters.js';
import { Paper } from '../src/types/index.js';

function buildPaper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: 'https://web1.karlsruhe.de/oparl/bodies/0001/papers/ag/1',
    type: 'https://schema.oparl.org/1.1/Paper',
    body: 'https://web1.karlsruhe.de/oparl/bodies/0001',
    name: 'Gebäude für Klimawandel ausstatten',
    reference: '2026/0580',
    date: '2026-07-22',
    paperType: 'Antrag',
    auxiliaryFile: [],
    underDirectionOf: [],
    consultation: [],
    created: '2026-07-22T00:00:00+02:00',
    modified: '2026-07-22T00:00:00+02:00',
    ...overrides,
  };
}

/** A paper with a single attachment whose extracted text is `text`. */
function paperWithDocument(text: string, overrides: Partial<Paper> = {}): [Paper, () => string] {
  const fileId = 'https://web1.karlsruhe.de/oparl/bodies/0001/files/679841';
  const paper = buildPaper({
    auxiliaryFile: [
      {
        id: fileId,
        name: 'Antrag',
        downloadUrl: 'https://example.invalid/679841.pdf',
      } as Paper['auxiliaryFile'][number],
    ],
    ...overrides,
  });
  return [paper, () => text];
}

describe('findFactionsInText', () => {
  it('splits joint faction spellings into their individual parties', () => {
    expect(findFactionsInText('GRÜNE, CDU, SPD, FDP/FW, Die Linke, KAL, Volt, FÜR')).toEqual([
      'gruene',
      'cdu',
      'spd',
      'fdp',
      'fw',
      'die-linke',
      'kal',
      'volt',
      'fuer',
    ]);
  });

  it('prefers the longest spelling so party names containing a slash stay intact', () => {
    expect(findFactionsInText('B´90/DIE GRÜNEN-OR-Fraktion')).toEqual(['gruene']);
    expect(findFactionsInText('KAL/Die PARTEI')).toEqual(['kal', 'die-partei']);
  });

  it('normalizes casing variants to one canonical id', () => {
    expect(findFactionsInText('DIE LINKE., Die Linke, FW | FÜR, FDP|FW')).toEqual([
      'die-linke',
      'fw',
      'fuer',
      'fdp',
    ]);
  });

  it('does not match a faction name inside a longer word', () => {
    expect(findFactionsInText('Die Grünewaldstraße und der SPDurchgang')).toEqual([]);
  });

  it('ignores the ordinary German word "für"', () => {
    expect(findFactionsInText('Antrag: Mehr Mittel für Schulen')).toEqual([]);
  });

  it('yields nothing when a labelled line introduces motion text instead of a submitter', () => {
    expect(findFactionsInText('Antrag: Tempo 30 im gesamten Stadtteil')).toEqual([]);
  });
});

describe('isMotionPaper', () => {
  it('accepts the faction-submitted types including per-Teilhaushalt budget motions', () => {
    expect(isMotionPaper('Antrag')).toBe(true);
    expect(isMotionPaper('Anfrage')).toBe(true);
    expect(isMotionPaper('Änderungs-/Ergänzungsantrag')).toBe(true);
    expect(isMotionPaper('Haushalt THH 4100')).toBe(true);
  });

  it('rejects administration papers', () => {
    expect(isMotionPaper('Beschlussvorlage')).toBe(false);
    expect(isMotionPaper('Informationsvorlage')).toBe(false);
    expect(isMotionPaper('Offenlage')).toBe(false);
    expect(isMotionPaper('')).toBe(false);
  });
});

describe('findPaperSubmitters', () => {
  it('reads the labelled Gemeinderat letterhead line', () => {
    const [paper, getText] = paperWithDocument(
      [
        'Antrag',
        'Gedruckt auf 100 Prozent Recyclingpapier',
        'Vorlage Nr.: 2026/0580',
        'Eingang: 21.08.2026',
        'Gebäude für Klimawandel ausstatten',
        'Antrag: GRÜNE',
        'Gremien Termin TOP Ö / N Zuständigkeit',
      ].join('\n'),
    );

    expect(findPaperSubmitters(paper, getText)).toEqual(['gruene']);
  });

  it('reads an interfraktionelle submission', () => {
    const [paper, getText] = paperWithDocument(
      [
        'Interfraktioneller Antrag',
        'Vorlage Nr.: 2026/0088/1',
        'Interfraktionelle Resolution: GRÜNE, CDU, SPD, FDP/FW, Die Linke, KAL, Volt, FÜR',
      ].join('\n'),
    );

    expect(findPaperSubmitters(paper, getText)).toEqual([
      'gruene',
      'cdu',
      'spd',
      'fdp',
      'fw',
      'die-linke',
      'kal',
      'volt',
      'fuer',
    ]);
  });

  it('reads the bare Ortschaftsrat faction line', () => {
    const [paper, getText] = paperWithDocument(
      [
        'Antrag',
        'Vorlage Nr.: 2026/0427',
        'Eingang: 22.05.2026',
        'Provisorium Auer Straße beseitigen',
        'FDP-OR-Fraktion',
      ].join('\n'),
    );

    expect(findPaperSubmitters(paper, getText)).toEqual(['fdp']);
  });

  it('reads a submitter embedded in the Eingang line', () => {
    const [paper, getText] = paperWithDocument(
      'Eingang: 10.03.2026 / Antrag der SPD / Bürgerliste-Ortschaftsratsfraktion',
    );

    expect(findPaperSubmitters(paper, getText)).toEqual(['spd', 'buergerliste']);
  });

  it('deduplicates a faction repeated across attachments', () => {
    const paper = buildPaper({
      auxiliaryFile: [
        { id: 'files/1', name: 'Antrag' },
        { id: 'files/2', name: 'Stellungnahme Antrag' },
      ] as Paper['auxiliaryFile'],
    });

    expect(findPaperSubmitters(paper, () => 'Antrag: GRÜNE')).toEqual(['gruene']);
  });

  it('reads the legacy title style', () => {
    const paper = buildPaper({
      paperType: 'Änderungs-/Ergänzungsantrag',
      name: 'Änderungsantrag AfD: Resolution des Gemeinderates "Karlsruhe - Stadt der Vielfalt"',
    });

    expect(findPaperSubmitters(paper, () => undefined)).toEqual(['afd']);
  });

  it('reads a trailing parenthesised faction in the title', () => {
    const paper = buildPaper({
      paperType: 'Anfrage',
      name: 'Anfrage zur Situation „Alter Hälden Weg“ (MfG-Fraktion)',
    });

    expect(findPaperSubmitters(paper, () => undefined)).toEqual(['mfg']);
  });

  it('does not attribute administration papers that merely respond to a motion', () => {
    const [paper, getText] = paperWithDocument(
      ['Stellungnahme zum Antrag', 'Vorlage Nr.: 2026/0580', 'Antrag: GRÜNE'].join('\n'),
      { paperType: 'Beschlussvorlage' },
    );

    expect(findPaperSubmitters(paper, getText)).toEqual([]);
  });

  it('ignores faction mentions below the letterhead', () => {
    const [paper, getText] = paperWithDocument(
      ['Antrag', 'Vorlage Nr.: 2026/0001', ...Array(30).fill('Fülltext'), 'Antrag: CDU'].join('\n'),
    );

    expect(findPaperSubmitters(paper, getText)).toEqual([]);
  });

  it('returns nothing when no attachment text has been extracted yet', () => {
    const [paper, getText] = paperWithDocument('');
    void getText;

    expect(findPaperSubmitters(paper, () => undefined)).toEqual([]);
    expect(paper.paperType).toBe('Antrag');
  });
});

describe('faction registry', () => {
  it('exposes a display name for every id', () => {
    for (const faction of listFactions()) {
      expect(getFactionName(faction.id)).toBe(faction.name);
    }
  });

  it('keeps ids unique, ASCII and slug-shaped so they are safe as URL/query keys', () => {
    const ids = listFactions().map((faction) => faction.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  /**
   * Guards the published contract: these ids are join keys in a consuming viewer,
   * so changing one silently breaks it. Add to this list, never edit it.
   */
  it('pins the published ids', () => {
    expect(listFactions().map((faction) => faction.id)).toEqual([
      'gruene',
      'cdu',
      'spd',
      'afd',
      'fdp',
      'fw',
      'fuer',
      'kal',
      'die-linke',
      'volt',
      'die-partei',
      'kult',
      'gfk',
      'mfg',
      'buergerliste',
    ]);
  });
});
