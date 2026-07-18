import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchPaginatedCollection: vi.fn(),
  fetchOParlResource: vi.fn(),
}));

vi.mock('../src/api/http.js', () => ({
  fetchPaginatedCollection: mocks.fetchPaginatedCollection,
  fetchOParlResource: mocks.fetchOParlResource,
}));

import { synchronizeMeetings } from '../src/api/meetings.js';
import { stores } from '../src/store/index.js';
import type { Meeting } from '../src/types/index.js';

function meeting(id: string, modified: string): Meeting {
  return {
    id,
    type: 'Meeting',
    name: `Sitzung ${id}`,
    start: modified,
    end: modified,
    location: {} as Meeting['location'],
    organization: [],
    created: modified,
    modified,
    agendaItem: [],
  };
}

/** Makes the mocked collection fetch deliver the given meetings via its page callback. */
function deliver(meetings: Meeting[]): void {
  mocks.fetchPaginatedCollection.mockImplementation(
    async (_url: string, onPage: (items: Meeting[]) => void) => {
      onPage(meetings);
      return { pageCount: 1, totalItems: meetings.length };
    },
  );
}

describe('synchronizeMeetings preserves the archive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stores.meetings.clear();
  });

  it('keeps meetings that drop out of the collection on a full reconciliation', async () => {
    stores.meetings.replaceAll([
      meeting('https://example.test/meetings/1', '2025-01-01T00:00:00Z'),
      meeting('https://example.test/meetings/2', '2025-01-01T00:00:00Z'),
    ]);

    // Full reconciliation (modifiedSince undefined) where meeting 2 is no longer exposed.
    deliver([meeting('https://example.test/meetings/1', '2026-07-18T00:00:00Z')]);
    await synchronizeMeetings(undefined);

    const ids = stores.meetings.getAll().map((m) => m.id);
    expect(ids).toContain('https://example.test/meetings/2'); // preserved, not wiped
    expect(stores.meetings.getById('https://example.test/meetings/1')?.modified).toBe(
      '2026-07-18T00:00:00Z', // still refreshed
    );
  });

  it('removes meetings only on an explicit OParl deleted tombstone', async () => {
    stores.meetings.replaceAll([
      meeting('https://example.test/meetings/1', '2025-01-01T00:00:00Z'),
    ]);

    deliver([
      {
        ...meeting('https://example.test/meetings/1', '2026-07-18T00:00:00Z'),
        deleted: true,
      } as Meeting,
    ]);
    await synchronizeMeetings(undefined);

    expect(stores.meetings.getById('https://example.test/meetings/1')).toBeUndefined();
  });
});
