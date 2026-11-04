import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ atomicWriteFile: vi.fn() }));
vi.mock('../src/docs-files.js', async (original) => ({
  ...(await original<typeof import('../src/docs-files.js')>()),
  atomicWriteFile: mocks.atomicWriteFile,
}));
import { canonicalStringify } from '../src/docs-files.js';
import { stores } from '../src/store/index.js';
import {
  buildPaperSimilarityIndex,
  PAPER_SIMILARITY_MAXIMUM_NEIGHBOR_COUNT,
  writePaperSimilarityIndex,
} from '../src/services/paper-similarity-index-service.js';
import { Paper } from '../src/types/index.js';

const makePaper = (id: string, name: string, reference = `2026/${id}`) =>
  ({
    id: `https://example.test/papers/${id}`,
    name,
    reference,
    auxiliaryFile: [],
    consultation: [],
    underDirectionOf: [],
    modified: '2026-01-01T00:00:00Z',
    date: '2026-01-01',
  }) as unknown as Paper;

describe('published paper similarity index', () => {
  beforeEach(() => {
    stores.clear();
    vi.clearAllMocks();
  });
  it('uses record basenames, excludes explicit links, diversifies families and serializes deterministically', async () => {
    const papers = [
      makePaper('1', 'Stadthalle Sanierung Brandschutz'),
      makePaper('2', 'Stadthalle Sanierung Brandschutz Bühnentechnik', '2026/0002'),
      makePaper('3', 'Stadthalle Sanierung Brandschutz Kosten', '2026/0002/1'),
      makePaper('4', 'Stadthalle Brandschutz Technik'),
      ...Array.from({ length: 40 }, (_, i) =>
        makePaper(`filler-${i}`, `Unrelated${'x'.repeat(i + 1)}`),
      ),
    ];
    for (const paper of papers) stores.papers.add(paper);
    const relations = { version: 1 as const, papers: { '1': { '4': ['cites' as const] } } };
    const index = buildPaperSimilarityIndex(relations);
    expect(index.version).toBe(4);
    expect(index.papers['1']).toHaveLength(1);
    expect(['2', '3']).toContain(index.papers['1'][0]);
    for (const [id, neighbors] of Object.entries(index.papers)) {
      expect(neighbors.length).toBeLessThanOrEqual(PAPER_SIMILARITY_MAXIMUM_NEIGHBOR_COUNT);
      expect(neighbors).not.toContain(id);
    }
    const bytes = canonicalStringify(index);
    stores.clear();
    for (const paper of [...papers].reverse()) stores.papers.add(paper);
    expect(canonicalStringify(buildPaperSimilarityIndex(relations))).toBe(bytes);
    await writePaperSimilarityIndex(index);
    expect(mocks.atomicWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('/docs/paper-similar.json'),
      bytes,
    );
  });
  it('publishes up to five neighbours, best first, and cuts the sixth', () => {
    expect(PAPER_SIMILARITY_MAXIMUM_NEIGHBOR_COUNT).toBe(5);
    // Each candidate shares fewer title terms with the query than the one before,
    // so the ranking is strict and the sixth is the one that must be dropped.
    const shared = [
      'stadthalle',
      'sanierung',
      'brandschutz',
      'bühnentechnik',
      'lüftung',
      'akustik',
    ];
    const query = makePaper('q', shared.join(' '));
    const candidates = shared.map((_, i) =>
      makePaper(
        `c${i}`,
        `${shared.slice(0, shared.length - i).join(' ')} Gutachten${i}`,
        `2026/1${i}`,
      ),
    );
    for (const paper of [
      query,
      ...candidates,
      ...Array.from({ length: 80 }, (_, i) =>
        makePaper(`filler-${i}`, `Unrelated${'x'.repeat(i + 1)}`),
      ),
    ])
      stores.papers.add(paper);
    const index = buildPaperSimilarityIndex({ version: 1, papers: {} });
    expect(index.papers['q']).toEqual(['c0', 'c1', 'c2', 'c3', 'c4']);
  });
  it('refuses colliding record basenames instead of merging different papers', () => {
    stores.papers.add(makePaper('99', 'Stadthalle Sanierung'));
    stores.papers.add({
      ...makePaper('99', 'Stadthalle Technik'),
      id: 'https://example.test/papers/other/99',
    });
    expect(() => buildPaperSimilarityIndex({ version: 1, papers: {} })).toThrow(
      'filename collision',
    );
  });
});
