import { Feed } from 'feed';
import { config } from './config.js';
import { EPOCH_FALLBACK_DATE } from './constants.js';
import { parseValidDate } from './dates.js';
import { createEmptyFeed, writeFeedFile } from './feed.js';
import { escapeHtml } from './html.js';
import { logger } from './logger.js';
import { committeeName } from './services/meeting-digest-service.js';
import { MeetingDigest, MeetingDigestLead } from './types/index.js';

const LEAD_LABELS: Record<MeetingDigestLead, string> = {
  week: 'eine Woche vorher',
  day: 'Tag davor',
};

/**
 * Previews live in their own feed rather than the agenda-item feeds. They
 * describe a sitting that has not happened — a different object from an agenda
 * item with a Beratungsstand — and a subscriber who wants "what is coming up"
 * is not the same subscriber who wants every item of every committee.
 */
export function buildMeetingDigestFeed(digests: MeetingDigest[]): Feed {
  const selfLink = new URL(config.meetingDigestFeedFileName, config.feedBaseUrl).href;
  const feed = createEmptyFeed(EPOCH_FALLBACK_DATE, {
    title: `${config.feedTitle} – Sitzungsvorschau`,
    description:
      'KI-generierte Vorschauen auf öffentliche Sitzungen, jeweils eine Woche vorher und am Vortag.',
    id: selfLink,
    link: config.feedBaseUrl,
    selfLink,
  });

  for (const digest of digests) appendMeetingDigest(feed, digest);
  feed.items.sort(
    (a, b) => b.date.getTime() - a.date.getTime() || String(a.id).localeCompare(String(b.id)),
  );
  // Anchored to the newest entry, not the run clock, so an unchanged set of
  // previews produces a byte-identical feed — the same contract the agenda feeds
  // hold to, and what lets git dedupe the blob and readers get a 304.
  feed.options.updated = latestEntryDate(feed) ?? EPOCH_FALLBACK_DATE;
  return feed;
}

function appendMeetingDigest(feed: Feed, digest: MeetingDigest): void {
  const meetingRecordId = digest.meetingId.split('/').pop() ?? '';
  const meetingUrl = `https://sitzungskalender.karlsruhe.de/db/ratsinformation/termin-${encodeURIComponent(meetingRecordId)}`;
  // Dated to the sitting, not to generation: deterministic across runs, and it
  // puts the sitting a reader is about to attend at the top of the feed.
  const date = parseValidDate(digest.meetingStart) ?? EPOCH_FALLBACK_DATE;
  // The record keeps the OParl name verbatim; the reader gets the committee. The
  // "(öffentlich/nicht öffentlich)" suffix describes the sitting's record, and the
  // model never sees it either — same helper, so title and prompt cannot diverge.
  const committee = committeeName(digest.meetingName);
  const highlightsHtml =
    digest.highlights.length > 0
      ? `<ul>${digest.highlights.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>`
      : '';

  feed.addItem({
    title: `Vorschau (${LEAD_LABELS[digest.lead]}): ${committee}`,
    id: `${digest.meetingId}#vorschau-${digest.lead}`,
    link: meetingUrl,
    date,
    description: digest.overview,
    content: `
      <b>Sitzung:</b> ${escapeHtml(committee)}<br>
      <b>Datum:</b> ${formatGermanDate(date)}<br><br>
      ${escapeHtml(digest.overview)}
      ${highlightsHtml}
      <small>Automatisch erstellt aus den Kurzfassungen der Vorlagen; maßgeblich sind die
      Originalunterlagen. Die Sitzung hat zum Zeitpunkt der Erstellung noch nicht
      stattgefunden.</small>
    `,
  });
}

export async function writeMeetingDigestFeed(digests: MeetingDigest[]): Promise<Feed> {
  const feed = buildMeetingDigestFeed(digests);
  const outputPath = await writeFeedFile(feed, config.meetingDigestFeedFileName);
  logger.info(
    `Meeting preview feed (${feed.items.length} entries) has been saved to ${outputPath}`,
  );
  return feed;
}

function latestEntryDate(feed: Feed): Date | undefined {
  let latest: Date | undefined;
  for (const item of feed.items) {
    if (item.date && (!latest || item.date.getTime() > latest.getTime())) latest = item.date;
  }
  return latest;
}

function formatGermanDate(date: Date): string {
  return date.toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
}
