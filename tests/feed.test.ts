import { afterEach, describe, expect, it, vi } from 'vitest';

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  rm: vi.fn(),
  readdir: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock('fs/promises', () => ({ default: fsMocks }));

import { config } from '../src/config.js';
import {
  buildAgendaFeed,
  buildAgendaFeedFromRecords,
  writeRecentFeed,
} from '../src/feed.js';
import { slugifyFeedSegment } from '../src/filtered-feed-contract.js';
import { buildFilteredFeedGroups, writeFilteredFeeds } from '../src/filtered-feeds.js';
import { buildAgendaItemRecords } from '../src/services/agenda-item-record-service.js';
import { stores } from '../src/store/index.js';
import type { Meeting, OParlFile, Organization, Paper } from '../src/types/index.js';

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
    stores.clear();
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

  it('builds joined records and emits organization, district and paper-type categories', () => {
    const organizationId = 'https://example.test/organizations/42';
    const consultationId = 'https://example.test/consultations/7';
    const organization: Organization = {
      id: organizationId,
      type: 'Organization',
      body: 'https://example.test/bodies/1',
      name: 'Planungsausschuss',
      shortName: 'PA',
      startDate: '2020-01-01',
      created: '2020-01-01T00:00:00Z',
      modified: '2025-01-01T00:00:00Z',
    };
    const paper: Paper = {
      id: 'https://example.test/papers/9',
      type: 'Paper',
      body: 'https://example.test/bodies/1',
      name: 'Vorlage Durlach',
      reference: '2025/9',
      date: '2025-01-01',
      paperType: 'Beschlussvorlage',
      auxiliaryFile: [],
      underDirectionOf: [],
      consultation: [
        {
          id: consultationId,
          type: 'Consultation',
          agendaItem: 'https://example.test/agendaItems/1',
          meeting: 'https://example.test/meetings/1',
          organization: [organizationId],
          role: 'beratend',
          created: '2025-01-01T00:00:00Z',
          modified: '2025-01-01T00:00:00Z',
        },
      ],
      created: '2025-01-01T00:00:00Z',
      modified: '2025-02-01T00:00:00Z',
    };
    stores.organizations.add(organization);
    stores.papers.add(paper);

    const meeting = meetingWithDates(
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z',
      '2025-03-01T00:00:00Z',
    );
    meeting.organization = [organizationId];
    meeting.agendaItem[0].consultation = consultationId;

    const records = buildAgendaItemRecords([meeting], {
      districtIndex: { '2025/9': ['Durlach'] },
    });
    expect(records[0]).toMatchObject({
      paper: { id: paper.id },
      organizations: [{ id: organizationId, name: 'Planungsausschuss' }],
      districts: ['Durlach'],
    });

    const xml = buildAgendaFeedFromRecords(records).atom1();
    expect(xml).toContain('term="https://example.test/organizations/42"');
    expect(xml).toContain('term="durlach"');
    expect(xml).toContain('term="Beschlussvorlage"');
  });

  it('writes discoverable committee and district feeds and removes stale feed files', async () => {
    fsMocks.readdir.mockResolvedValueOnce(['42.xml', 'stale.xml']).mockResolvedValueOnce([]);
    const meeting = meetingWithDates(
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z',
      '2025-03-01T00:00:00Z',
    );
    meeting.organization = ['https://example.test/organizations/42'];
    const records = buildAgendaItemRecords([meeting]);
    records[0].organizations[0].name = 'Planungsausschuss';
    records[0].districts = ['Südstadt'];

    const descriptors = await writeFilteredFeeds(records);

    expect(descriptors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'committee', path: 'gremien/42.xml', entryCount: 1 }),
        expect.objectContaining({
          type: 'district',
          path: 'stadtteile/suedstadt.xml',
          entryCount: 1,
        }),
      ]),
    );
    expect(fsMocks.unlink).toHaveBeenCalledWith(expect.stringMatching(/gremien\/stale\.xml$/));
    expect(fsMocks.rename.mock.calls.map((call) => call[1])).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/gremien\/42\.xml$/),
        expect.stringMatching(/stadtteile\/suedstadt\.xml$/),
        expect.stringMatching(/feed-index\.json$/),
      ]),
    );
  });

  it('fails before writing when filtered feed filenames collide', async () => {
    const meeting = meetingWithDates(
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z',
      '2025-03-01T00:00:00Z',
    );
    meeting.organization = [
      'https://example.test/organizations/a:b',
      'https://example.test/organizations/a?b',
    ];

    await expect(writeFilteredFeeds(buildAgendaItemRecords([meeting]))).rejects.toThrow(
      'filename collision',
    );
    expect(fsMocks.writeFile).not.toHaveBeenCalled();
  });

  it('creates stable German URL slugs', () => {
    expect(slugifyFeedSegment('Südstadt')).toBe('suedstadt');
    expect(slugifyFeedSegment('Weiherfeld-Dammerstock')).toBe('weiherfeld-dammerstock');
  });

  it('caps each filtered feed independently', () => {
    const meeting = meetingWithDates(
      '2025-01-01T00:00:00Z',
      '2025-01-02T00:00:00Z',
      '2025-03-01T00:00:00Z',
    );
    meeting.organization = ['https://example.test/organizations/42'];
    const record = buildAgendaItemRecords([meeting])[0];
    record.districts = ['Durlach'];

    const groups = buildFilteredFeedGroups([record, record, record], 2);
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.records.length === 2)).toBe(true);
  });
});
