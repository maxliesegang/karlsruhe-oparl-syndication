import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { MeetingDigestStore } from '../src/store/meeting-digest-store.js';
import { MeetingDigest } from '../src/types/index.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'meeting-digest-store-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function digest(lead: 'week' | 'day', overview = 'Vorschau.'): MeetingDigest {
  return {
    id: `https://ris/meetings/500-${lead}`,
    meetingId: 'https://ris/meetings/500',
    meetingName: 'Gemeinderat',
    meetingStart: '2026-08-08T16:00:00Z',
    lead,
    overview,
    highlights: ['TOP 1: Beratung.'],
    sourceHash: 'sha256:abc',
    promptVersion: 'meeting-de-v1',
    provider: 'test-provider',
    model: 'test-model',
    generatedAt: '2026-08-01T09:00:00Z',
    sourcePapers: ['900'],
    uncoveredCount: 0,
  };
}

async function fileNames(): Promise<string[]> {
  return (await fs.readdir(path.join(tmpDir, 'digests/meetings'))).sort();
}

describe('MeetingDigestStore', () => {
  it('keeps the two lead times of one sitting as separate records', async () => {
    // The week-ahead and day-before previews are different documents about the
    // same sitting, so the lead is part of the identity, not only the filename.
    const store = new MeetingDigestStore(tmpDir);
    store.add(digest('week'));
    store.add(digest('day'));
    await store.saveToDisk();

    expect(await fileNames()).toEqual(['500-day.json', '500-week.json']);
  });

  it('round-trips a record unchanged', async () => {
    const store = new MeetingDigestStore(tmpDir);
    store.add(digest('week'));
    await store.saveToDisk();

    const reloaded = new MeetingDigestStore(tmpDir);
    await reloaded.loadFromDisk();
    expect(reloaded.getById('https://ris/meetings/500-week')).toEqual(digest('week'));
  });

  it('leaves an unchanged record byte-identical so git dedupes the blob', async () => {
    const store = new MeetingDigestStore(tmpDir);
    store.add(digest('week'));
    await store.saveToDisk();
    const first = await fs.readFile(path.join(tmpDir, 'digests/meetings/500-week.json'), 'utf8');

    store.add(digest('week'));
    await store.saveToDisk();
    const second = await fs.readFile(path.join(tmpDir, 'digests/meetings/500-week.json'), 'utf8');
    expect(second).toBe(first);
  });
});
