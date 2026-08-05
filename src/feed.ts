import { Feed } from 'feed';
import { OParlFile, Meeting } from './types/index.js';
import { config } from './config.js';
import { parseValidDate } from './dates.js';
import { normalizeOParlUrl } from './oparl-url.js';
import {
  EPOCH_FALLBACK_DATE,
  FEED_GENERATOR,
  RECENT_FEED_MAX_ITEM_COUNT,
  SUBMITTER_CATEGORY_SCHEME,
} from './constants.js';
import { escapeHtml, safeHttpUrl } from './html.js';
import { logger } from './logger.js';
import { atomicWriteFile, docsPath } from './docs-files.js';
import { AgendaItemRecord, buildAgendaItemRecords } from './services/agenda-item-record-service.js';
import { DISTRICT_FEED_DIRECTORY, slugifyFeedSegment } from './filtered-feed-contract.js';
import { getFactionName } from './paper-submitters.js';

export interface FeedMetadata {
  title: string;
  description: string;
  id: string;
  link: string;
  selfLink: string;
}

export interface BuildAgendaFeedOptions {
  fallbackDate?: Date;
  metadata?: FeedMetadata;
  logProgress?: boolean;
}

/** Initialize a new, empty feed with the given metadata. */
function createEmptyFeed(updatedAt: Date, metadata?: FeedMetadata): Feed {
  const resolved = metadata ?? {
    title: config.feedTitle,
    description: config.feedDescription,
    id: config.feedId,
    link: config.feedBaseUrl,
    selfLink: new URL(config.feedFileName, config.feedBaseUrl).href,
  };
  return new Feed({
    title: resolved.title,
    description: resolved.description,
    id: resolved.id,
    link: resolved.link,
    language: config.feedLanguage,
    updated: updatedAt,
    generator: FEED_GENERATOR,
    copyright: config.feedCopyright,
    feedLinks: {
      atom: resolved.selfLink,
    },
    author: {
      name: config.authorName,
      email: config.authorEmail,
      link: config.authorUrl,
    },
  });
}

/** Format a 'de-DE' date in the given style, or a placeholder when it is missing/invalid. */
function formatGermanDate(date: Date | undefined, month: 'long' | '2-digit' = '2-digit'): string {
  if (!date) return 'unbekannt';
  return date.toLocaleDateString('de-DE', {
    year: 'numeric',
    month,
    day: month === 'long' ? 'numeric' : '2-digit',
  });
}

/** Format auxiliary file metadata for display */
function formatAttachmentLink(file: OParlFile): string {
  const correctedUrl = safeHttpUrl(normalizeOParlUrl(file.downloadUrl));
  if (!correctedUrl) return '';
  const createdDate = formatGermanDate(parseValidDate(file.created));
  const modifiedDate = formatGermanDate(parseValidDate(file.modified));

  return `<a href="${escapeHtml(correctedUrl)}">${escapeHtml(file.name)} (Erstellt am: ${createdDate}, Aktualisiert am: ${modifiedDate})</a><br>`;
}

/** Render the HTML body shown for a single agenda-item entry. */
function renderEntryContent(
  record: AgendaItemRecord,
  meetingDay: string,
  attachmentHtml: string,
): string {
  const { meeting, agendaItem, paperSummary, submitters } = record;
  const submitterHtml =
    submitters.length > 0
      ? `<b>Antragstellende Fraktion${submitters.length > 1 ? 'en' : ''}:</b> ${escapeHtml(submitters.map(getFactionName).join(', '))}<br><br>`
      : '';
  const proceduralStatusHtml = agendaItem.result?.trim()
    ? `<b>Beratungsstand dieser Sitzung:</b> ${escapeHtml(agendaItem.result.trim())}<br><br>`
    : '';
  const summaryHtml = paperSummary
    ? `<b>KI-generierte Zusammenfassung:</b> ${escapeHtml(paperSummary.summary)}${
        paperSummary.keyPoints.length > 0
          ? `<ul>${paperSummary.keyPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>`
          : ''
      }<small>Automatisch erstellt; maßgeblich sind die Originalunterlagen.</small><br><br>`
    : '';
  return `
      <b>Sitzung:</b> ${escapeHtml(meeting.name)}<br>
      <b>Datum:</b> ${meetingDay}<br>
      <b>TOP ${escapeHtml(agendaItem.number ?? '')}:</b> ${escapeHtml(agendaItem.name)}<br>
      ${proceduralStatusHtml}
      ${submitterHtml}
      ${summaryHtml}
      <b>Anhänge:</b><br> ${attachmentHtml}
    `;
}

/** Add an agenda item to the feed. */
function appendAgendaItem(feed: Feed, record: AgendaItemRecord): void {
  const { agendaItem, meeting, attachments } = record;

  const meetingId = meeting.id.split('/').pop() ?? '';
  const agendaItemUrl = `https://sitzungskalender.karlsruhe.de/db/ratsinformation/termin-${encodeURIComponent(meetingId)}#top${encodeURIComponent(agendaItem.number)}`;

  const attachmentHtml = attachments.map(formatAttachmentLink).join('');
  const meetingDay = formatGermanDate(parseValidDate(meeting.start), 'long');
  const summaryDescription = record.paperSummary?.summary ?? agendaItem.name;
  const description = agendaItem.result?.trim()
    ? `Beratungsstand: ${agendaItem.result.trim()} – ${summaryDescription}`
    : summaryDescription;

  feed.addItem({
    title: escapeHtml(agendaItem.name),
    id: agendaItem.id,
    link: agendaItemUrl,
    author: [{ name: meeting.name }],
    description: escapeHtml(description),
    content: renderEntryContent(record, meetingDay, attachmentHtml),
    date: record.updatedAt,
    published: record.publishedAt,
    category: buildEntryCategories(record),
  });
}

function buildEntryCategories(record: AgendaItemRecord): Array<{
  name: string;
  term: string;
  scheme: string;
}> {
  const categories = record.organizations.map((organization) => ({
    name: organization.name,
    term: organization.id,
    scheme: 'https://oparl.org/schema/1.1/Organization',
  }));

  categories.push(
    ...record.districts.map((district) => ({
      name: district,
      term: slugifyFeedSegment(district),
      scheme: new URL(`${DISTRICT_FEED_DIRECTORY}/`, config.feedBaseUrl).href,
    })),
  );

  // term is the stable faction id, label the display name — so a subscriber's
  // filter survives a rename of the printed faction name.
  categories.push(
    ...record.submitters.map((submitter) => ({
      name: getFactionName(submitter),
      term: submitter,
      scheme: SUBMITTER_CATEGORY_SCHEME,
    })),
  );

  if (record.paper?.paperType) {
    categories.push({
      name: record.paper.paperType,
      term: record.paper.paperType,
      scheme: 'https://oparl.org/schema/1.1/Paper',
    });
  }

  return categories;
}

/** The most recent entry date in the feed, or undefined when the feed has no entries. */
function findLatestFeedEntryDate(feed: Feed): Date | undefined {
  let latest: Date | undefined;
  for (const item of feed.items) {
    if (item.date && (!latest || item.date.getTime() > latest.getTime())) {
      latest = item.date;
    }
  }
  return latest;
}

/** Create the feed with metadata and meetings */
export async function buildAgendaFeedFromMeetings(
  meetings: Meeting[],
  fallbackDate: Date = EPOCH_FALLBACK_DATE,
): Promise<Feed> {
  return buildAgendaFeed(buildAgendaItemRecords(meetings, { fallbackDate }), {
    fallbackDate,
  });
}

/** Build the main feed from already joined records. */
export function buildAgendaFeed(
  records: AgendaItemRecord[],
  options: BuildAgendaFeedOptions = {},
): Feed {
  const fallbackDate = options.fallbackDate ?? EPOCH_FALLBACK_DATE;
  if (options.logProgress !== false) logger.info('Starting to create feed...');
  const feed = createEmptyFeed(fallbackDate, options.metadata);
  for (const record of records) appendAgendaItem(feed, record);
  // Sort newest-first with a stable id tiebreaker so the serialized order is fully
  // deterministic (independent of readdir/Map insertion order). Without this the full
  // feed's byte output — and its git diff — depended on filesystem enumeration order.
  feed.items.sort(
    (a, b) => b.date.getTime() - a.date.getTime() || String(a.id).localeCompare(String(b.id)),
  );
  // Anchor the feed-level <updated> to the newest entry rather than the run clock, so an
  // unchanged run produces a byte-identical feed. That lets git dedupe the blob and lets
  // subscribers' readers get a 304 instead of re-downloading the whole feed every poll.
  // Falls back to the deterministic fallback only when the feed is empty.
  feed.options.updated = findLatestFeedEntryDate(feed) ?? fallbackDate;
  if (options.logProgress !== false) logger.info('Finished creating feed.');
  return feed;
}

/** Write the feed to the file system */
export async function writeFullFeed(feed: Feed): Promise<void> {
  const outputPath = await writeFeedFile(feed, config.feedFileName);
  logger.info(`Feed has been saved to ${outputPath}`);
}

/** Write a trimmed feed containing only the most recent items to the file system */
export async function writeRecentFeed(
  feed: Feed,
  maximumItemCount = RECENT_FEED_MAX_ITEM_COUNT,
): Promise<void> {
  const recentFeedUrl = new URL(config.recentFeedFileName, config.feedBaseUrl).href;
  const recentFeed = new Feed({
    ...feed.options,
    id: recentFeedUrl,
    feedLinks: { atom: recentFeedUrl },
    description: feed.options.description ?? '',
    link: feed.options.link ?? '',
    copyright: feed.options.copyright ?? '',
  });

  const recentItems = [...feed.items]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, maximumItemCount);

  for (const item of recentItems) {
    recentFeed.addItem(item);
  }

  const outputPath = await writeFeedFile(recentFeed, config.recentFeedFileName);
  logger.info(`Recent feed (last ${maximumItemCount} items) has been saved to ${outputPath}`);
}

export async function writeFeedFile(feed: Feed, fileName: string): Promise<string> {
  // atomicWriteFile creates the parent directory, so no explicit mkdir is needed.
  const outputPath = docsPath(fileName);
  await atomicWriteFile(outputPath, feed.atom1());
  return outputPath;
}
