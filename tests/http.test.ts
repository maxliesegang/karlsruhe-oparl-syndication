import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config.js';
import { fetchAllPages, formatDateForUrl, httpClient } from '../src/api/http.js';

describe('HTTP pagination', () => {
  const originalDelay = config.requestDelay;

  afterEach(() => {
    config.requestDelay = originalDelay;
    vi.restoreAllMocks();
  });

  it('follows corrected next links and accumulates page totals', async () => {
    config.requestDelay = 0;
    const get = vi
      .spyOn(httpClient, 'get')
      .mockResolvedValueOnce({
        data: {
          data: [{ id: 'one' }],
          links: { next: 'https://example.test/oparl/items?page=2' },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ id: 'two' }, { id: 'three' }],
          links: {},
        },
      });
    const pages: string[][] = [];

    const result = await fetchAllPages<{ id: string }>(
      'https://example.test/ris/oparl/items?limit=1000',
      (items) => pages.push(items.map(({ id }) => id)),
    );

    expect(result).toEqual({ pageCount: 2, totalItems: 3 });
    expect(pages).toEqual([['one'], ['two', 'three']]);
    expect(get).toHaveBeenNthCalledWith(2, 'https://example.test/ris/oparl/items?page=2');
  });

  it('adds modified_since and can stop after the first page', async () => {
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({
      data: {
        data: [{ id: 'one' }],
        links: { next: 'https://example.test/oparl/items?page=2' },
      },
    });
    const modifiedSince = new Date('2026-07-18T10:15:30.123Z');

    const result = await fetchAllPages<{ id: string }>(
      'https://example.test/ris/oparl/items?limit=1000',
      () => undefined,
      { modifiedSince, fetchAllPages: false },
    );

    expect(result).toEqual({ pageCount: 1, totalItems: 1 });
    expect(get).toHaveBeenCalledWith(
      'https://example.test/ris/oparl/items?limit=1000&modified_since=2026-07-18T10%3A15%3A30%2B00%3A00',
    );
    expect(formatDateForUrl(modifiedSince)).toBe('2026-07-18T10:15:30+00:00');
  });
});
