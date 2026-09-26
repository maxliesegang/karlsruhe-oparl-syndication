import { describe, expect, it } from 'vitest';
import { buildMeetingDigestFeed } from '../src/meeting-digest-feed.js';
import {
  IncompleteDigestResponseError,
  TruncatedDigestResponseError,
  isRetryableResponse,
  normalizeMeetingDigestBody,
  truncateAtSentence,
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

  it('renders an empty overview without a blank summary', () => {
    // meeting-de-v2 may leave the overview empty rather than write filler; the
    // Atom <summary> then falls back to the first point.
    const [item] = buildMeetingDigestFeed([{ ...digest, overview: '' }]).items;
    expect(item.description).toBe('TOP 1: Der Umbau steht zur Beratung an.');
    expect(item.content).not.toContain('<p></p>');
  });

  it('tells the reader how much of the agenda had no summary', () => {
    const [none] = buildMeetingDigestFeed([digest]).items;
    expect(none.content).not.toContain('keine Kurzfassung');
    const [some] = buildMeetingDigestFeed([{ ...digest, uncoveredCount: 4 }]).items;
    expect(some.content).toContain(
      'Für 4 öffentliche Tagesordnungspunkte lag keine Kurzfassung vor',
    );
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

describe('truncateAtSentence', () => {
  it('keeps a text within the limit unchanged', () => {
    expect(truncateAtSentence('Kurz.', 500)).toBe('Kurz.');
  });

  it('cuts at the last whole sentence instead of mid-word', () => {
    // meeting-de-v1 sliced at 500 characters and published “… gesichert s”.
    const text =
      'TOP 1: Die Verwaltung schlägt das Parkraumkonzept vor. ' +
      'Die Projektstellen sind derzeit nur bis Februar bzw. März 2027 gesichert.';
    expect(truncateAtSentence(text, 100)).toBe(
      'TOP 1: Die Verwaltung schlägt das Parkraumkonzept vor.',
    );
  });

  it('does not treat a day ordinal as a sentence end', () => {
    const text =
      'TOP 3: Die Verwaltung unterstützt das Anliegen. Das Verbot soll bis zum 31. März 2027 verlängert werden, sagt sie.';
    expect(truncateAtSentence(text, 90)).not.toMatch(/31\.$/);
  });

  it('prefers a word cut with an ellipsis over discarding most of the window', () => {
    // A sentence end in the first half would throw away more than it keeps.
    const text =
      'TOP 1: Kurz. Die Projektstellen sind derzeit nur bis Februar 2027 gesichert und werden geprüft.';
    const result = truncateAtSentence(text, 60);
    expect(result).toBe('TOP 1: Kurz. Die Projektstellen sind derzeit nur bis…');
  });

  it('does not treat an abbreviation or a date as a sentence end', () => {
    const text =
      'Die Stellen sind bis 31.07.2026 bzw. ca. März gesichert und werden danach geprüft';
    const result = truncateAtSentence(text, 70);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toMatch(/bzw\.$|ca\.$/);
    expect(result.length).toBeLessThanOrEqual(70);
  });

  it('bounds normalized highlights at a sentence boundary', () => {
    const sentence = 'Die Vorlage schlägt eine längere Maßnahme mit vielen Einzelheiten vor. ';
    const [highlight] = normalizeMeetingDigestBody({
      overview: '',
      highlights: [`TOP 1: ${sentence.repeat(10)}`],
    }).highlights;
    expect(highlight.length).toBeLessThanOrEqual(500);
    expect(highlight.endsWith('vor.')).toBe(true);
  });
});
