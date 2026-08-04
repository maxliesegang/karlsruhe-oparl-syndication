import { beforeEach, describe, expect, it } from 'vitest';

import { PaperStore } from '../src/store/paper-store.js';
import type { Consultation, OParlFile, Paper } from '../src/types/index.js';

/**
 * Exercises the store's reverse indexes through its public API: consultation →
 * paper (what the feed joins agenda items on) and file → papers (what decides
 * which papers the Stadtteil index re-analyzes when attachment text changes).
 *
 * Attachment dates are deliberately ancient so `isRecentFileDate` is false and no
 * PDF extraction is scheduled — this test must never touch the network.
 */
const ARCHIVED = '2015-01-01T00:00:00+01:00';

function paper(id: string, overrides: Partial<Paper> = {}): Paper {
  return {
    id,
    type: 'Paper',
    name: `Vorlage ${id}`,
    reference: id,
    date: ARCHIVED,
    paperType: 'Antrag',
    created: ARCHIVED,
    modified: ARCHIVED,
    ...overrides,
  } as Paper;
}

function consultation(id: string): Consultation {
  return { id, type: 'Consultation' } as Consultation;
}

function auxiliaryFile(id: string): OParlFile {
  return {
    id,
    type: 'File',
    name: `Anlage ${id}`,
    downloadUrl: `https://example.test/${id}.pdf`,
    created: ARCHIVED,
    modified: ARCHIVED,
  } as OParlFile;
}

describe('PaperStore reverse indexes', () => {
  let store: PaperStore;

  beforeEach(() => {
    store = new PaperStore();
  });

  it('resolves a paper by any of its consultations', () => {
    store.add(paper('p1', { consultation: [consultation('c1'), consultation('c2')] }));

    expect(store.getPaperByConsultationId('c1')?.id).toBe('p1');
    expect(store.getPaperByConsultationId('c2')?.id).toBe('p1');
    expect(store.getPaperByConsultationId('c3')).toBeUndefined();
  });

  it('forgets consultations a re-fetched paper no longer carries', () => {
    store.add(paper('p1', { consultation: [consultation('c1'), consultation('c2')] }));
    store.add(paper('p1', { consultation: [consultation('c2')] }));

    expect(store.getPaperByConsultationId('c1')).toBeUndefined();
    expect(store.getPaperByConsultationId('c2')?.id).toBe('p1');
  });

  it('lets a consultation move to another paper without the old paper reclaiming it', () => {
    store.add(paper('p1', { consultation: [consultation('c1')] }));
    store.add(paper('p2', { consultation: [consultation('c1')] }));
    store.add(paper('p1', { consultation: [] }));

    expect(store.getPaperByConsultationId('c1')?.id).toBe('p2');
  });

  it('maps a shared attachment to every paper that references it', () => {
    store.add(paper('p1', { auxiliaryFile: [auxiliaryFile('f1'), auxiliaryFile('f2')] }));
    store.add(paper('p2', { auxiliaryFile: [auxiliaryFile('f2')] }));

    expect(store.getPaperIdsByFileIds(['f2']).sort()).toEqual(['p1', 'p2']);
    expect(store.getPaperIdsByFileIds(['f1'])).toEqual(['p1']);
    expect(store.getPaperIdsByFileIds(['unknown'])).toEqual([]);
  });

  it('drops both indexes when a tombstone removes the paper', () => {
    store.add(paper('p1', { consultation: [consultation('c1')], auxiliaryFile: [auxiliaryFile('f1')] }));
    store.add({ ...paper('p1'), deleted: true } as Paper);

    expect(store.getById('p1')).toBeUndefined();
    expect(store.getPaperByConsultationId('c1')).toBeUndefined();
    expect(store.getPaperIdsByFileIds(['f1'])).toEqual([]);
  });
});
