import { beforeEach, describe, expect, it, vi } from 'vitest';

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  rm: vi.fn(),
  readFile: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock('fs/promises', () => ({ default: fsMocks }));

import {
  createPaperDistrictResolver,
  PAPER_DISTRICT_INDEX_FILE_NAME,
  PAPER_DISTRICT_INDEX_VERSION,
  PaperDistrictIndex,
  updatePaperDistrictIndex,
} from '../src/services/paper-district-index-service.js';
import { stores } from '../src/store/index.js';
import type { FileContent } from '../src/types/file-content.js';
import type { Organization, Paper } from '../src/types/index.js';

const PAPER_ID = 'https://web1.karlsruhe.de/oparl/bodies/0001/papers/ag/99';
const FILE_ID = 'https://web1.karlsruhe.de/oparl/bodies/0001/files/679841';
const ORTSCHAFTSRAT_ID = 'https://web1.karlsruhe.de/oparl/bodies/0001/organizations/gr/17';

function buildPaper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: PAPER_ID,
    type: 'https://schema.oparl.org/1.1/Paper',
    body: 'https://web1.karlsruhe.de/oparl/bodies/0001',
    name: 'Sachstandsbericht',
    reference: '2026/0580',
    date: '2026-07-22',
    paperType: 'Beschlussvorlage',
    auxiliaryFile: [{ id: FILE_ID, name: 'Vorlage' } as Paper['auxiliaryFile'][number]],
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

function addOrtschaftsrat(name: string): void {
  stores.organizations.add({
    id: ORTSCHAFTSRAT_ID,
    type: 'https://schema.oparl.org/1.1/Organization',
    body: 'https://web1.karlsruhe.de/oparl/bodies/0001',
    name,
    shortName: name,
    startDate: '2019-01-01',
    created: '2019-01-01T00:00:00+01:00',
    modified: '2019-01-01T00:00:00+01:00',
  } as Organization);
}

/** The index as it was actually serialized by the run under test. */
function writtenIndex(): PaperDistrictIndex {
  const payload = fsMocks.writeFile.mock.calls.at(-1)?.[1] as string;
  return JSON.parse(payload) as PaperDistrictIndex;
}

describe('paper district index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stores.clear();
    // No stored index on disk, so every run below starts from a full rebuild.
    fsMocks.readFile.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
  });

  it('keys entries on the papers/ record basename', async () => {
    stores.papers.add(buildPaper({ name: 'Neubau Turnhalle Hagsfeld' }));

    const index = await updatePaperDistrictIndex();

    expect(index.papers).toEqual({ '99': { primary: ['Hagsfeld'] } });
  });

  it('keeps papers that share a reference apart', async () => {
    // References are not unique — 2019/1012 belongs to two papers in the real
    // archive — so the previous reference-keyed index dropped one of them.
    stores.papers.add(
      buildPaper({
        id: 'https://web1.karlsruhe.de/oparl/bodies/0001/papers/ag/394',
        name: 'Radweg Durlach',
        reference: '2019/1012',
        auxiliaryFile: [],
      }),
    );
    stores.papers.add(
      buildPaper({
        id: 'https://web1.karlsruhe.de/oparl/bodies/0001/papers/vo/38195',
        name: 'Spielplatz Neureut',
        reference: '2019/1012',
        auxiliaryFile: [],
      }),
    );

    const index = await updatePaperDistrictIndex();

    expect(index.papers).toEqual({
      '394': { primary: ['Durlach'] },
      '38195': { primary: ['Neureut'] },
    });
  });

  it('rejects paper basename collisions instead of overwriting an entry', async () => {
    stores.papers.add(buildPaper());
    stores.papers.add(
      buildPaper({ id: 'https://web1.karlsruhe.de/oparl/bodies/0002/papers/ag/99' }),
    );

    await expect(updatePaperDistrictIndex()).rejects.toThrow(/filename collision/);
  });

  it('takes the district from the consulting Ortschaftsrat without reading any text', async () => {
    addOrtschaftsrat('Ortschaftsrat Wettersbach');
    stores.papers.add(
      buildPaper({
        auxiliaryFile: [],
        consultation: [
          {
            id: 'https://web1.karlsruhe.de/oparl/bodies/0001/consultations/1',
            type: 'https://schema.oparl.org/1.1/Consultation',
            agendaItem: 'https://web1.karlsruhe.de/oparl/bodies/0001/agendaItems/1',
            meeting: 'https://web1.karlsruhe.de/oparl/bodies/0001/meetings/1',
            organization: [ORTSCHAFTSRAT_ID],
            role: 'beratend',
            created: '2026-07-22T00:00:00+02:00',
            modified: '2026-07-22T00:00:00+02:00',
          },
        ],
      }),
    );

    const index = await updatePaperDistrictIndex();

    expect(index.papers['99']).toEqual({ primary: ['Grünwettersbach', 'Palmbach'] });
  });

  it('separates a passing mention from the paper subject', async () => {
    stores.papers.add(buildPaper({ name: 'Spielplatzsanierung Rintheim' }));
    addExtractedText(`Rintheim ${'x'.repeat(5000)} wie zuvor in Oberreut umgesetzt.`);

    const index = await updatePaperDistrictIndex();

    expect(index.papers['99']).toEqual({ primary: ['Rintheim'], mentioned: ['Oberreut'] });
  });

  it('publishes the full district registry, not only the districts seen this run', async () => {
    stores.papers.add(buildPaper({ name: 'Neubau Turnhalle Hagsfeld' }));

    const index = await updatePaperDistrictIndex();

    expect(index.version).toBe(PAPER_DISTRICT_INDEX_VERSION);
    expect(index.districts).toContain('Palmbach');
    // Every district referenced by a paper must resolve against the registry.
    for (const entry of Object.values(index.papers)) {
      for (const district of [...(entry.primary ?? []), ...(entry.mentioned ?? [])]) {
        expect(index.districts).toContain(district);
      }
    }
  });

  it('drops entries for papers the archive no longer holds', async () => {
    fsMocks.readFile.mockResolvedValue(
      JSON.stringify({
        version: PAPER_DISTRICT_INDEX_VERSION,
        districts: [],
        papers: { '99': { primary: ['Durlach'] }, gone: { primary: ['Neureut'] } },
      }),
    );
    stores.papers.add(buildPaper({ name: 'Radweg Durlach', auxiliaryFile: [] }));
    stores.papers.drainUpdatedPaperIds();

    const index = await updatePaperDistrictIndex();

    expect(Object.keys(index.papers)).toEqual(['99']);
  });

  it('rebuilds in full when the stored index predates the current shape', async () => {
    // The version 1 file was an unversioned reference-keyed map.
    fsMocks.readFile.mockResolvedValue(JSON.stringify({ '2026/0580': ['Durlach'] }));
    stores.papers.add(buildPaper({ name: 'Spielplatz Neureut', auxiliaryFile: [] }));
    stores.papers.drainUpdatedPaperIds();

    const index = await updatePaperDistrictIndex();

    expect(index.papers).toEqual({ '99': { primary: ['Neureut'] } });
  });

  it('removes the superseded reference-tracking file after writing', async () => {
    stores.papers.add(buildPaper({ auxiliaryFile: [] }));

    await updatePaperDistrictIndex();

    expect(fsMocks.unlink.mock.calls[0][0]).toContain('paper-stadtteile-meta.json');
  });

  it('writes canonical, byte-stable JSON so an unchanged archive produces no diff', async () => {
    stores.papers.add(buildPaper({ name: 'Radweg Durlach', auxiliaryFile: [] }));

    await updatePaperDistrictIndex();
    const first = fsMocks.writeFile.mock.calls.at(-1)?.[1] as string;
    stores.clear();
    stores.papers.add(buildPaper({ name: 'Radweg Durlach', auxiliaryFile: [] }));
    await updatePaperDistrictIndex();
    const second = fsMocks.writeFile.mock.calls.at(-1)?.[1] as string;

    expect(first).toBe(second);
    expect(first.endsWith('\n')).toBe(true);
    const keys = Object.keys(JSON.parse(first));
    expect(keys).toEqual([...keys].sort());
    expect(fsMocks.rename.mock.calls[0][1]).toContain(PAPER_DISTRICT_INDEX_FILE_NAME);
    expect(writtenIndex().papers).toEqual({ '99': { primary: ['Durlach'] } });
  });

  it('resolves only primary districts for the feed', async () => {
    stores.papers.add(buildPaper({ name: 'Spielplatzsanierung Rintheim' }));
    addExtractedText(`${'x'.repeat(5000)} wie zuvor in Oberreut umgesetzt.`);
    const resolve = createPaperDistrictResolver(await updatePaperDistrictIndex());

    // Oberreut is only mentioned in passing, so a Stadtteil subscriber is not sent it.
    expect(resolve({ id: PAPER_ID })).toEqual(['Rintheim']);
    expect(resolve({ id: 'https://web1.karlsruhe.de/oparl/bodies/0001/papers/ag/1' })).toEqual([]);
  });
});
