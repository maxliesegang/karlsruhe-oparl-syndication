import { describe, expect, it } from 'vitest';
import { BaseStore } from '../src/store/base-store.js';

interface TestItem {
  id: string;
  created: string;
  modified?: string;
  value?: string;
}

class TestStore extends BaseStore<TestItem> {
  getFileName(): string {
    return 'test-items.json';
  }
}

describe('BaseStore reconciliation', () => {
  it('removes the cached object when an incremental response contains a deleted tombstone', () => {
    const store = new TestStore();
    store.add({ id: 'kept', created: '2026-01-01T00:00:00Z' });
    store.add({ id: 'removed', created: '2026-01-01T00:00:00Z', value: 'old' });

    store.add({
      id: 'removed',
      created: '2026-01-01T00:00:00Z',
      deleted: true,
    } as TestItem);

    expect(store.getById('removed')).toBeUndefined();
    expect(store.getAllItems()).toEqual([
      { id: 'kept', created: '2026-01-01T00:00:00Z' },
    ]);
  });

  it('replaces the cache during an authoritative full crawl', () => {
    const store = new TestStore();
    store.add({ id: 'stale', created: '2025-01-01T00:00:00Z' });

    store.replaceAll([
      { id: 'current', created: '2026-01-01T00:00:00Z' },
      {
        id: 'deleted',
        created: '2026-01-01T00:00:00Z',
        deleted: true,
      } as TestItem,
    ]);

    expect(store.getAllItems()).toEqual([
      { id: 'current', created: '2026-01-01T00:00:00Z' },
    ]);
  });
});
