import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { PerRecordStore } from '../src/store/per-record-store.js';
import { canonicalStringify } from '../src/file-utils.js';
import { PaperStore } from '../src/store/paper-store.js';
import { MeetingStore } from '../src/store/meeting-store.js';
import { Meeting, Paper } from '../src/types/index.js';

interface Rec {
  id: string;
  created: string;
  modified?: string;
  value?: string;
}

class TestPerRecordStore extends PerRecordStore<Rec> {
  readonly storageFileName = 'recs.json';
  readonly recordDirectoryName = 'recs';
}

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'per-record-store-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function rec(id: string, value?: string): Rec {
  return { id: `https://ris/records/${id}`, created: '2026-01-01T00:00:00Z', value };
}

async function readRecordsDir(): Promise<string[]> {
  const dir = path.join(tmpDir, 'recs');
  const entries = await fs.readdir(dir);
  return entries.filter((f) => f.endsWith('.json')).sort();
}

describe('canonicalStringify', () => {
  it('is byte-identical across serializations of the same value', () => {
    const value = { b: 1, a: { d: [3, 2, 1], c: 'x' } };
    expect(canonicalStringify(value)).toBe(canonicalStringify(value));
  });

  it('is independent of input key order', () => {
    const a = { id: '1', name: 'x', nested: { z: 1, a: 2 } };
    const b = { nested: { a: 2, z: 1 }, name: 'x', id: '1' };
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });

  it('preserves array element order (order is meaningful)', () => {
    expect(canonicalStringify([3, 1, 2])).not.toBe(canonicalStringify([1, 2, 3]));
  });

  it('emits 2-space indentation with a trailing newline', () => {
    expect(canonicalStringify({ a: 1 })).toBe('{\n  "a": 1\n}\n');
  });
});

describe('PerRecordStore persistence', () => {
  it('writes one file per record named by the id last segment', async () => {
    const store = new TestPerRecordStore(tmpDir);
    store.add(rec('100'));
    store.add(rec('200'));
    await store.saveToDisk();

    expect(await readRecordsDir()).toEqual(['100.json', '200.json']);
    const raw = await fs.readFile(path.join(tmpDir, 'recs', '100.json'), 'utf8');
    expect(raw).toBe(canonicalStringify(rec('100')));
  });

  it('writes only records marked dirty; unchanged records are not rewritten', async () => {
    const store = new TestPerRecordStore(tmpDir);
    store.add(rec('100'));
    await store.saveToDisk();

    // Tamper with the on-disk file: a subsequent no-op persist must leave it be.
    const file100 = path.join(tmpDir, 'recs', '100.json');
    await fs.writeFile(file100, 'TAMPERED');

    // Re-adding an identical record must not mark it dirty.
    store.add(rec('100'));
    store.add(rec('200')); // new record: dirty
    await store.saveToDisk();

    expect(await fs.readFile(file100, 'utf8')).toBe('TAMPERED');
    expect(await readRecordsDir()).toEqual(['100.json', '200.json']);
  });

  it('rewrites a record whose serialization changed', async () => {
    const store = new TestPerRecordStore(tmpDir);
    store.add(rec('100', 'old'));
    await store.saveToDisk();

    store.add(rec('100', 'new'));
    await store.saveToDisk();

    const raw = await fs.readFile(path.join(tmpDir, 'recs', '100.json'), 'utf8');
    expect(JSON.parse(raw).value).toBe('new');
  });

  it('fails loudly on a filename collision instead of overwriting', async () => {
    const store = new TestPerRecordStore(tmpDir);
    // Different ids whose last segment sanitizes to the same filename.
    store.add({ id: 'https://ris/a/1 0', created: '2026-01-01T00:00:00Z' });
    store.add({ id: 'https://ris/b/1_0', created: '2026-01-01T00:00:00Z' });
    await expect(store.saveToDisk()).rejects.toThrow(/collision/);
  });
});

describe('PerRecordStore deletion and orphan cleanup', () => {
  it('unlinks a record file when a deleted:true tombstone arrives', async () => {
    const store = new TestPerRecordStore(tmpDir);
    store.add(rec('100'));
    store.add(rec('200'));
    await store.saveToDisk();
    expect(await readRecordsDir()).toEqual(['100.json', '200.json']);

    store.add({ ...rec('200'), deleted: true } as Rec);
    await store.saveToDisk();

    expect(await readRecordsDir()).toEqual(['100.json']);
    expect(store.getById('https://ris/records/200')).toBeUndefined();
  });

  it('removes orphan *.json files with no in-store record, leaving other files alone', async () => {
    const store = new TestPerRecordStore(tmpDir);
    store.add(rec('100'));
    await store.saveToDisk();

    const dir = path.join(tmpDir, 'recs');
    await fs.writeFile(path.join(dir, 'orphan.json'), '{}');
    await fs.writeFile(path.join(dir, 'keep.txt'), 'not a record');

    store.add(rec('100'));
    await store.saveToDisk();

    const all = (await fs.readdir(dir)).sort();
    expect(all).toEqual(['100.json', 'keep.txt']);
  });

  it('does not run orphan cleanup when a record write fails', async () => {
    const store = new TestPerRecordStore(tmpDir);
    const dir = path.join(tmpDir, 'recs');
    await fs.mkdir(dir, { recursive: true });
    // A pre-existing orphan that must survive a failed persist.
    await fs.writeFile(path.join(dir, 'orphan.json'), '{}');
    // Force the write of record "500" to fail by occupying its target with a dir.
    await fs.mkdir(path.join(dir, '500.json'));

    store.add(rec('500'));
    await expect(store.saveToDisk()).rejects.toThrow();

    // Cleanup never ran: the orphan is still present.
    expect(await fs.readdir(dir)).toContain('orphan.json');
  });
});

describe('PerRecordStore directory loader round-trip', () => {
  it('round-trips papers and rebuilds the consultation index', async () => {
    const paper: Paper = {
      id: 'https://ris/papers/900',
      type: 'paper',
      body: 'b',
      name: 'Paper 900',
      reference: 'R-900',
      date: '2026-01-01',
      paperType: 'Vorlage',
      auxiliaryFile: [],
      underDirectionOf: [],
      consultation: [
        {
          id: 'https://ris/consultations/c9',
          type: 'consultation',
          agendaItem: 'a',
          meeting: 'm',
          organization: [],
          role: 'r',
          created: '2026-01-01T00:00:00Z',
          modified: '2026-01-01T00:00:00Z',
        },
      ],
      created: '2026-01-01T00:00:00Z',
      modified: '2026-01-01T00:00:00Z',
    };

    const writer = new PaperStore(tmpDir);
    writer.add(paper);
    await writer.saveToDisk();

    const reader = new PaperStore(tmpDir);
    await reader.loadFromDisk();

    expect(reader.getAll()).toHaveLength(1);
    expect(reader.getById(paper.id)).toEqual(paper);
    expect(reader.getPaperByConsultationId('https://ris/consultations/c9')?.id).toBe(paper.id);
  });

  it('round-trips meetings and rebuilds the organization index', async () => {
    const meeting: Meeting = {
      id: 'https://ris/meetings/700',
      type: 'meeting',
      name: 'Meeting 700',
      start: '2026-01-01T10:00:00Z',
      end: '2026-01-01T12:00:00Z',
      location: {
        id: 'https://ris/locations/l7',
        type: 'location',
        description: 'Rathaus',
        created: '2026-01-01T00:00:00Z',
        modified: '2026-01-01T00:00:00Z',
      },
      organization: ['https://ris/organizations/o7'],
      created: '2026-01-01T00:00:00Z',
      modified: '2026-01-01T00:00:00Z',
      agendaItem: [],
    };

    const writer = new MeetingStore(tmpDir);
    writer.add(meeting);
    await writer.saveToDisk();

    const reader = new MeetingStore(tmpDir);
    await reader.loadFromDisk();

    expect(reader.getAll()).toHaveLength(1);
    expect(reader.getById(meeting.id)).toEqual(meeting);
    expect(
      reader.getMeetingsByOrganizationId('https://ris/organizations/o7').map((m) => m.id),
    ).toEqual([meeting.id]);
  });
});

describe('PerRecordStore legacy migration', () => {
  it('loads a legacy monolithic file then writes per-record files and deletes the legacy file', async () => {
    const legacyPath = path.join(tmpDir, 'recs.json');
    const legacy: Rec[] = [rec('1', 'a'), rec('2', 'b')];
    await fs.writeFile(legacyPath, JSON.stringify(legacy, null, 2));

    const store = new TestPerRecordStore(tmpDir);
    await store.loadFromDisk();
    expect(store.getAll()).toHaveLength(2);

    await store.saveToDisk();

    // Per-record files exist and the legacy monolithic file is gone.
    expect(await readRecordsDir()).toEqual(['1.json', '2.json']);
    await expect(fs.access(legacyPath)).rejects.toThrow();

    // A fresh store now loads from the directory, not the (deleted) legacy file.
    const reader = new TestPerRecordStore(tmpDir);
    await reader.loadFromDisk();
    expect(
      reader
        .getAll()
        .map((r) => r.id)
        .sort(),
    ).toEqual(['https://ris/records/1', 'https://ris/records/2']);
  });

  it('migrates from the legacy file when the per-record directory exists but is empty', async () => {
    // Regression: an existing-but-empty directory must not be treated as an
    // authoritative empty store, which would then delete the legacy file and
    // wipe the archive. It must fall through to legacy migration instead.
    await fs.mkdir(path.join(tmpDir, 'recs'), { recursive: true });
    const legacyPath = path.join(tmpDir, 'recs.json');
    await fs.writeFile(legacyPath, JSON.stringify([rec('1', 'a'), rec('2', 'b')], null, 2));

    const store = new TestPerRecordStore(tmpDir);
    await store.loadFromDisk();
    expect(store.getAll()).toHaveLength(2);

    await store.saveToDisk();

    expect(await readRecordsDir()).toEqual(['1.json', '2.json']);
    await expect(fs.access(legacyPath)).rejects.toThrow();
  });
});

describe('PerRecordStore orphan-sweep guard', () => {
  it('aborts persistence instead of deleting an implausibly large share of records', async () => {
    // Seed a directory with many records, all persisted.
    const writer = new TestPerRecordStore(tmpDir);
    for (let i = 0; i < 200; i++) writer.add(rec(String(i)));
    await writer.saveToDisk();

    // Reload (so priorRecordCount reflects the 200 on disk), then drop almost all
    // of them from memory — as a truncated crawl or a bug would. The sweep would
    // otherwise delete ~all files; the guard must throw and leave them intact.
    const store = new TestPerRecordStore(tmpDir);
    await store.loadFromDisk();
    store.clear();
    store.add(rec('0'));

    await expect(store.saveToDisk()).rejects.toThrow(/refusing to remove/);
    expect((await readRecordsDir()).length).toBe(200);
  });
});
