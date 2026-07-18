import { afterEach, describe, expect, it, vi } from 'vitest';

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  rm: vi.fn(),
}));

vi.mock('fs/promises', () => ({ default: fsMocks }));

import { config } from '../src/config.js';
import { buildAgendaFeed, writeRecentFeed } from '../src/feed.js';
import type { Meeting } from '../src/types/index.js';

function meetingWithDates(created: string, modified: string, start: string): Meeting {
  return {
    id: 'https://example.test/meetings/1',
    type: 'Meeting',
    name: 'Testsitzung',
    start,
    end: start,
    location: {} as Meeting['location'],
    organization: [],
    created,
    modified,
    agendaItem: [
      {
        id: 'https://example.test/agendaItems/1',
        type: 'AgendaItem',
        meeting: 'https://example.test/meetings/1',
        number: '1',
        order: 1,
        name: 'TOP 1',
        public: true,
        created,
        modified,
      },
    ],
  };
}

describe('feed identity', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses absolute HTTPS production URLs in the default metadata', async () => {
    expect(new URL(config.feedId).protocol).toBe('https:');
    expect(new URL(config.feedBaseUrl).protocol).toBe('https:');
    expect(new URL(config.authorUrl).protocol).toBe('https:');
    expect(config.feedId).not.toContain('localhost');

    const feed = await buildAgendaFeed([], new Date('2026-07-18T12:00:00Z'));
    expect(() => feed.atom1()).not.toThrow();
  });

  it('gives the recent feed its own id and self link', async () => {
    const fullFeed = await buildAgendaFeed([], new Date('2026-07-18T12:00:00Z'));

    await writeRecentFeed(fullFeed);

    const xml = fsMocks.writeFile.mock.calls[0]?.[1];
    expect(xml).toEqual(expect.any(String));
    expect(xml).toContain(
      `<id>${new URL(config.recentFeedFileName, config.feedBaseUrl).toString()}</id>`,
    );
    expect(xml).toContain(
      `rel="self" href="${new URL(config.recentFeedFileName, config.feedBaseUrl).toString()}"`,
    );
    expect(xml).not.toContain(`<id>${config.feedId}</id>`);
  });

  it('serializes without throwing when an agenda item has invalid or empty dates', async () => {
    const feed = await buildAgendaFeed(
      [meetingWithDates('not-a-date', '', 'also-broken')],
      new Date('2026-07-18T12:00:00Z'),
    );
    expect(() => feed.atom1()).not.toThrow();
  });

  it('uses the supplied fallback date for entries with no valid dates', async () => {
    const fallback = new Date('2026-04-05T12:00:00.000Z');
    const feed = await buildAgendaFeed(
      [meetingWithDates('', 'not-a-date', 'also-broken')],
      fallback,
    );

    expect(feed.items[0]?.date).toEqual(fallback);
    expect(feed.items[0]?.published).toEqual(fallback);
  });

  it('anchors the feed-level updated to the newest entry, not the run clock', async () => {
    const feed = await buildAgendaFeed(
      [meetingWithDates('2020-01-01T00:00:00Z', '2024-05-06T00:00:00Z', '2024-05-10T00:00:00Z')],
      new Date('2026-07-18T12:00:00Z'), // run time must not leak into the feed metadata
    );
    const xml = feed.atom1();
    const header = xml.slice(0, xml.indexOf('<entry'));
    expect(header).toContain('<updated>2024-05-06T00:00:00.000Z</updated>');
    expect(header).not.toContain('2026-07-18T12:00:00.000Z');
  });

  it('falls back to the provided date for the feed-level updated when empty', async () => {
    const feed = await buildAgendaFeed([], new Date('2026-07-18T12:00:00Z'));
    const header = feed.atom1();
    expect(header).toContain('<updated>2026-07-18T12:00:00.000Z</updated>');
  });

  it('uses the item created date as published when valid', async () => {
    const feed = await buildAgendaFeed(
      [meetingWithDates('2025-01-02T00:00:00Z', '2026-07-18T00:00:00Z', '2026-07-20T00:00:00Z')],
      new Date('2026-07-18T12:00:00Z'),
    );
    const xml = feed.atom1();
    expect(xml).toContain('<published>2025-01-02T00:00:00.000Z</published>');
    expect(xml).toContain('<updated>2026-07-18T00:00:00.000Z</updated>');
  });
});
