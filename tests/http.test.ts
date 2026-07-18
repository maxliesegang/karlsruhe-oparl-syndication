import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config.js';
import {
  fetchPaginatedCollection,
  formatOParlDateQueryValue,
  httpClient,
} from '../src/api/http.js';

describe('HTTP pagination', () => {
  const originalInterval = config.requestIntervalMs;

  afterEach(() => {
    config.requestIntervalMs = originalInterval;
    vi.restoreAllMocks();
  });

  it('follows corrected next links and accumulates page totals', async () => {
    config.requestIntervalMs = 0;
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

    const result = await fetchPaginatedCollection<{ id: string }>(
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

    const result = await fetchPaginatedCollection<{ id: string }>(
      'https://example.test/ris/oparl/items?limit=1000',
      () => undefined,
      { modifiedSince, followPagination: false },
    );

    expect(result).toEqual({ pageCount: 1, totalItems: 1 });
    expect(get).toHaveBeenCalledWith(
      'https://example.test/ris/oparl/items?limit=1000&modified_since=2026-07-18T10%3A15%3A30%2B00%3A00',
    );
    expect(formatOParlDateQueryValue(modifiedSince)).toBe('2026-07-18T10:15:30+00:00');
  });

  it('treats a response with no links object as the terminal page', async () => {
    config.requestIntervalMs = 0;
    vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
      data: { data: [{ id: 'one' }] }, // no `links` at all, e.g. a final page
    });

    const result = await fetchPaginatedCollection<{ id: string }>(
      'https://example.test/ris/oparl/items?limit=1000',
      () => undefined,
    );

    expect(result).toEqual({ pageCount: 1, totalItems: 1 });
  });

  it('rejects a non-collection body so reconciliation is not marked complete', async () => {
    config.requestIntervalMs = 0;
    vi.spyOn(httpClient, 'get').mockResolvedValueOnce({ data: {} }); // e.g. an HTML/error body

    await expect(
      fetchPaginatedCollection<{ id: string }>(
        'https://example.test/ris/oparl/items?limit=1000',
        () => undefined,
      ),
    ).rejects.toThrow('had no data array');
  });

  it('rejects a pagination cycle instead of reporting an incomplete crawl as successful', async () => {
    config.requestIntervalMs = 0;
    // Every page points back to page two: a cycle the crawl must break out of.
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({
      data: {
        data: [{ id: 'loop' }],
        links: { next: 'https://example.test/ris/oparl/items?page=2' },
      },
    });

    await expect(
      fetchPaginatedCollection<{ id: string }>(
        'https://example.test/ris/oparl/items?page=2',
        () => undefined,
      ),
    ).rejects.toThrow('Pagination cycle detected');
    expect(get).toHaveBeenCalledTimes(1);
  });
});
