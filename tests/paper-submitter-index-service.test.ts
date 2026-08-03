import { beforeEach, describe, expect, it, vi } from 'vitest';

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  rm: vi.fn(),
  readdir: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock('fs/promises', () => ({ default: fsMocks }));

import {
  buildPaperSubmitterIndex,
  createSubmitterResolver,
  PAPER_SUBMITTER_INDEX_FILE_NAME,
  writePaperSubmitterIndex,
} from '../src/services/paper-submitter-index-service.js';
import { stores } from '../src/store/index.js';
import type { FileContent } from '../src/types/file-content.js';
import type { Paper } from '../src/types/index.js';

const FILE_ID = 'https://web1.karlsruhe.de/oparl/bodies/0001/files/679841';

function buildPaper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: 'https://web1.karlsruhe.de/oparl/bodies/0001/papers/ag/99',
    type: 'https://schema.oparl.org/1.1/Paper',
    body: 'https://web1.karlsruhe.de/oparl/bodies/0001',
    name: 'Gebäude für Klimawandel ausstatten',
    reference: '2026/0580',
    date: '2026-07-22',
    paperType: 'Antrag',
    auxiliaryFile: [{ id: FILE_ID, name: 'Antrag' } as Paper['auxiliaryFile'][number]],
    underDirectionOf: [],
    consultation: [],
    created: '2026-07-22T00:00:00+02:00',
    modified: '2026-07-22T00:00:00+02:00',
    ...overrides,
  };
}

function addExtractedText(text: string): void {
  stores.fileContents.add({
    id: FILE_ID,
    downloadUrl: 'https://example.invalid/679841.pdf',
    fileModified: '2026-07-22T00:00:00+02:00',
    lastModifiedExtractedDate: '2026-07-22T00:00:00+02:00',
    extractedText: text,
  } as FileContent);
}

describe('paper submitter index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stores.clear();
  });

  it('maps the papers/ record basename straight to the faction ids', () => {
    stores.papers.add(buildPaper());
    addExtractedText('Antrag\nVorlage Nr.: 2026/0580\nAntrag: GRÜNE');

    // No paper id or reference: both live in docs/papers/99.json, which a viewer
    // reads anyway, so duplicating them here would only be a second copy to drift.
    expect(buildPaperSubmitterIndex().papers).toEqual({ '99': ['gruene'] });
  });

  it('keeps papers that share a reference apart', () => {
    // References are not unique — 2019/1012 belongs to two papers in the real
    // archive — so a reference-keyed index would drop one of these attributions.
    stores.papers.add(
      buildPaper({ id: 'https://web1.karlsruhe.de/oparl/bodies/0001/papers/ag/394' }),
    );
    stores.papers.add(
      buildPaper({ id: 'https://web1.karlsruhe.de/oparl/bodies/0001/papers/vo/38195' }),
    );
    addExtractedText('Antrag: GRÜNE');

    expect(buildPaperSubmitterIndex().papers).toEqual({
      '394': ['gruene'],
      '38195': ['gruene'],
    });
  });

  it('publishes the full faction registry, not only the factions seen this run', () => {
    stores.papers.add(buildPaper());
    addExtractedText('Antrag: GRÜNE');
    const index = buildPaperSubmitterIndex();

    expect(index.version).toBe(3);
    expect(index.factions).toMatchObject({ gruene: 'GRÜNE', 'die-linke': 'Die Linke' });
    // Every id referenced by a paper must resolve against the registry.
    for (const submitters of Object.values(index.papers)) {
      for (const id of submitters) expect(index.factions[id]).toBeTruthy();
    }
  });

  it('omits papers without a detected submitter', () => {
    stores.papers.add(buildPaper({ paperType: 'Beschlussvorlage' }));
    addExtractedText('Beschlussvorlage\nAntrag: GRÜNE');

    expect(buildPaperSubmitterIndex().papers).toEqual({});
  });

  it('rejects paper basename collisions instead of overwriting an index entry', () => {
    stores.papers.add(buildPaper());
    stores.papers.add(
      buildPaper({
        id: 'https://web1.karlsruhe.de/oparl/bodies/0002/papers/ag/99',
      }),
    );

    expect(() => buildPaperSubmitterIndex()).toThrow(/filename collision/);
  });

  it('resolves submitters for the feed from the same index', () => {
    stores.papers.add(buildPaper());
    addExtractedText('Antrag: CDU, SPD');
    const resolve = createSubmitterResolver(buildPaperSubmitterIndex());

    expect(resolve({ id: 'https://web1.karlsruhe.de/oparl/bodies/0001/papers/ag/99' })).toEqual([
      'cdu',
      'spd',
    ]);
    expect(resolve({ id: 'https://web1.karlsruhe.de/oparl/bodies/0001/papers/ag/1' })).toEqual([]);
  });

  it('writes canonical, byte-stable JSON so an unchanged archive produces no diff', async () => {
    stores.papers.add(buildPaper());
    addExtractedText('Antrag: SPD');
    const index = buildPaperSubmitterIndex();

    await writePaperSubmitterIndex(index);
    await writePaperSubmitterIndex(index);

    const [first, second] = fsMocks.writeFile.mock.calls.map((call) => call[1] as string);
    expect(first).toBe(second);
    expect(first.endsWith('\n')).toBe(true);
    expect(JSON.parse(first)).toEqual(index);
    // Canonical serialization sorts keys recursively, which is what makes an
    // unchanged archive byte-identical run over run.
    const keys = Object.keys(JSON.parse(first));
    expect(keys).toEqual([...keys].sort());
    expect(fsMocks.rename.mock.calls[0][1]).toContain(PAPER_SUBMITTER_INDEX_FILE_NAME);
  });
});
