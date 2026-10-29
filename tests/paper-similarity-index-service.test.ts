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
    expect(index.version).toBe(3);
    expect(index.papers['1']).toHaveLength(1);
    expect(['2', '3']).toContain(index.papers['1'][0]);
    for (const [id, neighbors] of Object.entries(index.papers)) {
      expect(neighbors.length).toBeLessThanOrEqual(3);
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
