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
import type { Meeting, OParlFile } from '../src/types/index.js';

function attachment(overrides: Partial<OParlFile> = {}): OParlFile {
  return {
    id: 'https://example.test/files/1',
    type: 'File',
    name: 'Anlage',
    fileName: 'anlage.pdf',
    mimeType: 'application/pdf',
    date: '2025-01-01T00:00:00Z',
    accessUrl: 'https://example.test/files/1',
    downloadUrl: 'https://example.test/files/1/download',
    created: '2025-01-01T00:00:00Z',
    modified: '2025-01-02T00:00:00Z',
    ...overrides,
  };
}

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

  it('orders entries newest-first regardless of input order', async () => {
    const older = meetingWithDates(
      '2024-01-01T00:00:00Z',
      '2024-01-01T00:00:00Z',
      '2024-01-05T00:00:00Z',
    );
    const newer = meetingWithDates(
      '2025-06-01T00:00:00Z',
      '2025-06-01T00:00:00Z',
      '2025-06-05T00:00:00Z',
    );
    // Distinct ids so both entries survive (the feed keys by id).
    newer.id = 'https://example.test/meetings/2';
    newer.agendaItem![0].id = 'https://example.test/agendaItems/2';

    const feed = await buildAgendaFeed([older, newer]);
    expect(feed.items.map((i) => i.id)).toEqual([
      'https://example.test/agendaItems/2',
      'https://example.test/agendaItems/1',
    ]);
  });

  it('produces byte-identical output across runs with no run-clock argument', async () => {
    const meeting = meetingWithDates(
      '2025-01-02T00:00:00Z',
      '2025-03-04T00:00:00Z',
      '2025-03-10T00:00:00Z',
    );
    const first = (await buildAgendaFeed([meeting])).atom1();
    const second = (await buildAgendaFeed([meeting])).atom1();
    expect(first).toBe(second);
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

  it('omits agenda items that are not explicitly public', async () => {
    const meeting = meetingWithDates(
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z',
      '2025-01-03T00:00:00Z',
    );
    meeting.agendaItem[0].public = false;

    expect((await buildAgendaFeed([meeting])).items).toHaveLength(0);

    meeting.agendaItem[0].public = undefined as unknown as boolean;
    expect((await buildAgendaFeed([meeting])).items).toHaveLength(0);
  });

  it('includes direct agenda-item attachments and uses their timestamp for updated', async () => {
    const meeting = meetingWithDates(
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z',
      '2025-01-03T00:00:00Z',
    );
    meeting.agendaItem[0].auxiliaryFile = [
      attachment({ name: 'Direkte Anlage', modified: '2026-06-01T00:00:00Z' }),
    ];

    const feed = await buildAgendaFeed([meeting]);
    expect(feed.items[0]?.date).toEqual(new Date('2026-06-01T00:00:00Z'));
    expect(feed.atom1()).toContain('Direkte Anlage');
  });

  it('uses meeting changes for updated and escapes untrusted HTML content', async () => {
    const meeting = meetingWithDates(
      '2025-01-01T00:00:00Z',
      '2026-07-01T00:00:00Z',
      '2025-01-03T00:00:00Z',
    );
    meeting.name = '<img src=x onerror=alert(1)>';
    meeting.agendaItem[0].name = '<script>alert(1)</script>';
    meeting.agendaItem[0].auxiliaryFile = [
      attachment({
        name: '<b>unsafe</b>',
        downloadUrl: 'javascript:alert(1)',
      }),
    ];

    const feed = await buildAgendaFeed([meeting]);
    const xml = feed.atom1();
    expect(feed.items[0]?.date).toEqual(new Date('2026-07-01T00:00:00Z'));
    expect(xml).not.toContain('<script>alert(1)</script>');
    expect(xml).not.toContain('<img src=x');
    expect(xml).not.toContain('javascript:');
    expect(xml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
