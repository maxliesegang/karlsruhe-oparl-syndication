import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchAllPages: vi.fn(),
  fetchOne: vi.fn(),
}));

vi.mock('../src/api/http.js', () => ({
  fetchAllPages: mocks.fetchAllPages,
  fetchOne: mocks.fetchOne,
}));

import { fetchAllMeetings } from '../src/api/meetings.js';
import { store } from '../src/store/index.js';
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

/** Makes the mocked fetchAllPages deliver the given meetings via its onPage callback. */
function deliver(meetings: Meeting[]): void {
  mocks.fetchAllPages.mockImplementation(
    async (_url: string, onPage: (items: Meeting[]) => void) => {
      onPage(meetings);
      return { pageCount: 1, totalItems: meetings.length };
    },
  );
}

describe('fetchAllMeetings preserves the archive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.meetings.clearAllItems();
  });

  it('keeps meetings that drop out of the collection on a full reconciliation', async () => {
    store.meetings.replaceAll([
      meeting('https://example.test/meetings/1', '2025-01-01T00:00:00Z'),
      meeting('https://example.test/meetings/2', '2025-01-01T00:00:00Z'),
    ]);

    // Full reconciliation (modifiedSince undefined) where meeting 2 is no longer exposed.
    deliver([meeting('https://example.test/meetings/1', '2026-07-18T00:00:00Z')]);
    await fetchAllMeetings(undefined);

    const ids = store.meetings.getAllItems().map((m) => m.id);
    expect(ids).toContain('https://example.test/meetings/2'); // preserved, not wiped
    expect(store.meetings.getById('https://example.test/meetings/1')?.modified).toBe(
      '2026-07-18T00:00:00Z', // still refreshed
    );
  });

  it('removes meetings only on an explicit OParl deleted tombstone', async () => {
    store.meetings.replaceAll([meeting('https://example.test/meetings/1', '2025-01-01T00:00:00Z')]);

    deliver([
      { ...meeting('https://example.test/meetings/1', '2026-07-18T00:00:00Z'), deleted: true } as Meeting,
    ]);
    await fetchAllMeetings(undefined);

    expect(store.meetings.getById('https://example.test/meetings/1')).toBeUndefined();
  });
});
