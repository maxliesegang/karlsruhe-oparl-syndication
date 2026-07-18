import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { canonicalStringify } from '../src/file-utils.js';

// The store schedules PDF extraction on load/add via the extraction queue.
// Stub the queue so tests never touch the network and can assert scheduling.
const queueAdd = vi.fn();
vi.mock('../src/services/pdf-extraction-queue.js', () => ({
  pdfExtractionQueue: {
    add: (...args: unknown[]) => queueAdd(...args),
    waitForCompletion: async () => undefined,
  },
}));

// Keep extraction disabled by default so onItemLoad does not reschedule work
// unless a test opts in.
vi.mock('../src/config.js', () => ({
  config: { extractPdfText: false },
}));

import { FileContentStore } from '../src/store/file-content-store.js';
import { config } from '../src/config.js';
import { FileContentType } from '../src/types/file-content-type.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-content-store-'));
  queueAdd.mockClear();
  (config as { extractPdfText: boolean }).extractPdfText = false;
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const CONTENT_DIR = () => path.join(tmpDir, 'file-contents');
const LEGACY = () => path.join(tmpDir, 'file-contents.json');

function file(id: string, overrides: Partial<FileContentType> = {}): FileContentType {
  return {
    id: `https://ris/files/${id}`,
    downloadUrl: `https://ris/files/${id}/download`,
    fileModified: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function indexEntry(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `https://ris/files/${id}`,
    downloadUrl: `https://ris/files/${id}/download`,
    fileModified: '2026-01-01T00:00:00Z',
    hasExtractedText: false,
    ...overrides,
  };
}

async function readJsonFiles(): Promise<string[]> {
  const entries = await fs.readdir(CONTENT_DIR());
  return entries.filter((f) => f.endsWith('.json')).sort();
}

describe('FileContentStore canonical metadata serialization', () => {
  it('writes canonical metadata that is byte-identical and key-order independent', async () => {
    const store = new FileContentStore(tmpDir);
    store.add(file('100'));
    await store.persistItemsToFile();

    const raw = await fs.readFile(path.join(CONTENT_DIR(), '100.json'), 'utf8');
    // Keys sorted, 2-space indent, trailing newline, and independent of the
    // order the entry fields happened to be constructed in.
    expect(raw).toBe(canonicalStringify(indexEntry('100')));
    expect(raw).toBe(
      canonicalStringify({
        hasExtractedText: false,
        fileModified: '2026-01-01T00:00:00Z',
        downloadUrl: 'https://ris/files/100/download',
        id: 'https://ris/files/100',
      }),
    );
  });

  it('excludes extracted text from the metadata json (text lives in the .txt)', async () => {
    const store = new FileContentStore(tmpDir);
    store.add(file('100', { extractedText: 'hello world', lastModifiedExtractedDate: '2026-01-01T00:00:00Z' }));
    await store.persistItemsToFile();

    const raw = await fs.readFile(path.join(CONTENT_DIR(), '100.json'), 'utf8');
    expect(raw).not.toContain('hello world');
    expect(JSON.parse(raw).hasExtractedText).toBe(true);
    expect(await fs.readFile(path.join(CONTENT_DIR(), '100.txt'), 'utf8')).toBe('hello world');
  });
});

describe('FileContentStore dirty tracking', () => {
  it('writes only changed metadata records; unchanged ones are not rewritten', async () => {
    const store = new FileContentStore(tmpDir);
    store.add(file('100'));
    await store.persistItemsToFile();

    // Tamper with the on-disk file: a no-op persist must leave it untouched.
    const file100 = path.join(CONTENT_DIR(), '100.json');
    await fs.writeFile(file100, 'TAMPERED');

    store.add(file('100')); // identical: not dirty
    store.add(file('200')); // new: dirty
    await store.persistItemsToFile();

    expect(await fs.readFile(file100, 'utf8')).toBe('TAMPERED');
    expect(await readJsonFiles()).toEqual(['100.json', '200.json']);
  });

  it('rewrites a record whose metadata changed', async () => {
    const store = new FileContentStore(tmpDir);
    store.add(file('100', { fileModified: '2026-01-01T00:00:00Z' }));
    await store.persistItemsToFile();

    store.upsertFromPaperFile(file('100', { fileModified: '2026-02-02T00:00:00Z' }));
    await store.persistItemsToFile();

    const raw = await fs.readFile(path.join(CONTENT_DIR(), '100.json'), 'utf8');
    expect(JSON.parse(raw).fileModified).toBe('2026-02-02T00:00:00Z');
  });

  it('fails loudly on a metadata filename collision instead of overwriting', async () => {
    const store = new FileContentStore(tmpDir);
    store.add(file('1 0')); // sanitizes to 1_0.json
    store.add(file('1_0'));
    await expect(store.persistItemsToFile()).rejects.toThrow(/collision/);
  });
});

describe('FileContentStore orphan cleanup', () => {
  it('removes orphan metadata files but never the sibling .txt files', async () => {
    const store = new FileContentStore(tmpDir);
    store.add(file('100', { extractedText: 'text 100', lastModifiedExtractedDate: '2026-01-01T00:00:00Z' }));
    await store.persistItemsToFile();

    // A stray metadata orphan plus a text file that must survive the sweep.
    await fs.writeFile(path.join(CONTENT_DIR(), 'orphan.json'), '{}');
    await fs.writeFile(path.join(CONTENT_DIR(), 'keep.txt'), 'unrelated text');

    store.add(file('100', { extractedText: 'text 100', lastModifiedExtractedDate: '2026-01-01T00:00:00Z' }));
    await store.persistItemsToFile();

    const all = (await fs.readdir(CONTENT_DIR())).sort();
    expect(all).toEqual(['100.json', '100.txt', 'keep.txt']);
  });

  it('unlinks a metadata file when its record is removed', async () => {
    const store = new FileContentStore(tmpDir);
    store.add(file('100'));
    store.add(file('200'));
    await store.persistItemsToFile();
    expect(await readJsonFiles()).toEqual(['100.json', '200.json']);

    store.removeById('https://ris/files/200');
    await store.persistItemsToFile();
    expect(await readJsonFiles()).toEqual(['100.json']);
  });

  it('does not run orphan cleanup when a metadata write fails', async () => {
    const store = new FileContentStore(tmpDir);
    await fs.mkdir(CONTENT_DIR(), { recursive: true });
    // Pre-existing orphan that must survive a failed persist.
    await fs.writeFile(path.join(CONTENT_DIR(), 'orphan.json'), '{}');
    // Force the write of record "500" to fail by occupying its target with a dir.
    await fs.mkdir(path.join(CONTENT_DIR(), '500.json'));

    store.add(file('500'));
    await expect(store.persistItemsToFile()).rejects.toThrow();

    expect(await fs.readdir(CONTENT_DIR())).toContain('orphan.json');
  });
});

describe('FileContentStore directory loader round-trip', () => {
  it('reloads metadata, resolves text from .txt, and reschedules extraction', async () => {
    const writer = new FileContentStore(tmpDir);
    writer.add(
      file('100', { extractedText: 'extracted body', lastModifiedExtractedDate: '2026-01-01T00:00:00Z' }),
    );
    writer.add(file('200'));
    await writer.persistItemsToFile();

    // Enable extraction so the loader schedules re-extraction where needed.
    (config as { extractPdfText: boolean }).extractPdfText = true;
    queueAdd.mockClear();

    const reader = new FileContentStore(tmpDir);
    await reader.loadItemsFromFile();

    expect(reader.getAllItems().map((f) => f.id).sort()).toEqual([
      'https://ris/files/100',
      'https://ris/files/200',
    ]);
    expect(reader.getById('https://ris/files/100')?.extractedText).toBe('extracted body');
    // File 200 has no extracted text yet, so extraction is scheduled for it.
    expect(queueAdd).toHaveBeenCalledWith('https://ris/files/200/download', expect.any(Function));
  });

  it('does not rewrite unchanged metadata after a reload', async () => {
    const writer = new FileContentStore(tmpDir);
    writer.add(file('100', { extractedText: 'body', lastModifiedExtractedDate: '2026-01-01T00:00:00Z' }));
    await writer.persistItemsToFile();

    const reader = new FileContentStore(tmpDir);
    await reader.loadItemsFromFile();

    const file100 = path.join(CONTENT_DIR(), '100.json');
    await fs.writeFile(file100, 'TAMPERED');
    await reader.persistItemsToFile();

    expect(await fs.readFile(file100, 'utf8')).toBe('TAMPERED');
  });
});

describe('FileContentStore legacy migration', () => {
  it('loads a legacy index, then writes per-record files and deletes the legacy file', async () => {
    // Legacy layout: monolithic index plus co-located .txt files, no per-record json.
    await fs.mkdir(CONTENT_DIR(), { recursive: true });
    await fs.writeFile(path.join(CONTENT_DIR(), '1.txt'), 'legacy text 1');
    const legacy = [
      indexEntry('1', { hasExtractedText: true, lastModifiedExtractedDate: '2026-01-01T00:00:00Z' }),
      indexEntry('2'),
    ];
    await fs.writeFile(LEGACY(), JSON.stringify(legacy, null, 2));

    const store = new FileContentStore(tmpDir);
    await store.loadItemsFromFile();
    expect(store.getAllItems()).toHaveLength(2);
    expect(store.getById('https://ris/files/1')?.extractedText).toBe('legacy text 1');

    await store.persistItemsToFile();

    expect(await readJsonFiles()).toEqual(['1.json', '2.json']);
    await expect(fs.access(LEGACY())).rejects.toThrow();

    // A fresh store now loads from the directory, not the deleted legacy file.
    const reader = new FileContentStore(tmpDir);
    await reader.loadItemsFromFile();
    expect(reader.getAllItems().map((f) => f.id).sort()).toEqual([
      'https://ris/files/1',
      'https://ris/files/2',
    ]);
    expect(reader.getById('https://ris/files/1')?.extractedText).toBe('legacy text 1');
  });

  it('starts fresh when neither per-record files nor a legacy index exist', async () => {
    const store = new FileContentStore(tmpDir);
    await store.loadItemsFromFile();
    expect(store.getAllItems()).toHaveLength(0);
  });
});
