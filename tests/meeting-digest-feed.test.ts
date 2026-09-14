import { describe, expect, it } from 'vitest';
import { buildMeetingDigestFeed } from '../src/meeting-digest-feed.js';
import {
  IncompleteDigestResponseError,
  TruncatedDigestResponseError,
  isRetryableResponse,
  normalizeMeetingDigestBody,
} from '../src/services/llm/opencode-meeting-digest-writer.js';
import { MeetingDigest } from '../src/types/index.js';

const digest: MeetingDigest = {
  id: 'https://example.test/meetings/500-week',
  meetingId: 'https://example.test/meetings/500',
  meetingName: 'Gemeinderat (öffentlich/nicht öffentlich)',
  meetingStart: '2026-08-08T16:00:00Z',
  lead: 'week',
  overview: 'Der Gemeinderat berät über den Umbau des Marktplatzes.',
  highlights: ['TOP 1: Der Umbau steht zur Beratung an.'],
  sourceHash: 'sha256:abc',
  promptVersion: 'meeting-de-v1',
  provider: 'test-provider',
  model: 'test-model',
  generatedAt: '2026-08-01T09:00:00Z',
  sourcePapers: ['900'],
  uncoveredCount: 0,
};

describe('meeting digest feed', () => {
  it('is byte-identical for an unchanged set of previews', () => {
    // The feed's <updated> is anchored to the newest entry rather than the run
    // clock, so an unchanged run lets git dedupe the blob and readers get a 304.
    const first = buildMeetingDigestFeed([digest]).atom1();
    const second = buildMeetingDigestFeed([digest]).atom1();
    expect(first).toBe(second);
  });

  it('does not move when only generatedAt changes', () => {
    const regenerated = { ...digest, generatedAt: '2026-08-02T09:00:00Z' };
    expect(buildMeetingDigestFeed([regenerated]).atom1()).toBe(
      buildMeetingDigestFeed([digest]).atom1(),
    );
  });

  it('gives the two lead times distinct entries for one sitting', () => {
    const feed = buildMeetingDigestFeed([
      digest,
      { ...digest, id: `${digest.meetingId}-day`, lead: 'day' },
    ]);
    expect(feed.items).toHaveLength(2);
    expect(feed.items.map((item) => item.id)).toEqual([
      'https://example.test/meetings/500#vorschau-day',
      'https://example.test/meetings/500#vorschau-week',
    ]);
    expect(feed.items.map((item) => item.title)).toContain(
      'Vorschau (eine Woche vorher): Gemeinderat',
    );
  });

  it('strips the session-visibility suffix from the entry title', () => {
    // The record keeps the OParl name; the reader gets the committee, using the
    // same helper that builds the prompt heading.
    const [item] = buildMeetingDigestFeed([digest]).items;
    expect(item.title).toBe('Vorschau (eine Woche vorher): Gemeinderat');
  });

  it('escapes generated text in the entry body', () => {
    const feed = buildMeetingDigestFeed([{ ...digest, overview: 'Kosten & Fristen' }]);
    expect(feed.atom1()).toContain('Kosten &amp; Fristen');
  });

  it('strips markup from provider output before it can reach the feed', () => {
    // The Atom <summary> is emitted as raw CDATA by the feed library, so escaping
    // at render time does not cover it. Tag removal at normalization does, and it
    // is the only point every persisted digest passes through.
    expect(
      normalizeMeetingDigestBody({
        overview: 'Vorlage <script>alert(1)</script> & mehr',
        highlights: ['TOP 1: <b>Beratung</b>'],
      }),
    ).toEqual({
      overview: 'Vorlage alert(1) & mehr',
      highlights: ['TOP 1: Beratung'],
    });
  });

  it('produces an empty but valid feed when nothing is published', () => {
    const xml = buildMeetingDigestFeed([]).atom1();
    expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(xml).not.toContain('<entry>');
  });
});

describe('isRetryableResponse', () => {
  it('retries an object that came back missing a required key', () => {
    // Observed on the promoted spike: a 200 whose object had no `highlights`,
    // which then succeeded on each of two immediate re-runs of identical input.
    expect(isRetryableResponse(new IncompleteDigestResponseError(['highlights']))).toBe(true);
  });

  it('retries a response the provider cut off at the token budget', () => {
    // A truncated response can still parse — the provider closes the structure and
    // leaves a highlight cut mid-word, which nothing downstream can distinguish
    // from a short one. One such preview reached docs/ before this guard existed.
    expect(isRetryableResponse(new TruncatedDigestResponseError())).toBe(true);
  });

  it('does not retry a schema rejection of a complete object', () => {
    // A present-but-wrong value is a prompt or provider problem that another
    // identical request reproduces; spending two more calls on it is waste.
    expect(isRetryableResponse(new Error('Invalid input: expected array'))).toBe(false);
  });

  it('does not retry an unrelated failure', () => {
    expect(isRetryableResponse(new Error('timeout'))).toBe(false);
  });
});
