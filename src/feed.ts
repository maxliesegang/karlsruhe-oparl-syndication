import { Feed } from 'feed';
import { AgendaItem, OParlFile, Meeting } from './types/index.js';
import { config } from './config.js';
import { normalizeOParlUrl, latestValidDate, parseValidDate } from './utils.js';
import { stores } from './store/index.js';
import { FEED_GENERATOR } from './constants.js';
import { logger } from './logger.js';
import { atomicWriteFile, docsPath } from './file-utils.js';

/**
 * Deterministic fallback for entries (and an empty feed) that have no usable
 * date. Using a fixed epoch instead of the run clock keeps the XML byte-stable
 * across runs — a date-less entry no longer churns every run, and it cannot push
 * the feed-level <updated> to "now" and defeat conditional-GET/304 for readers.
 */
const FALLBACK_DATE = new Date(0);

/** Initialize a new, empty feed with the given metadata. */
function createEmptyFeed(updatedAt: Date): Feed {
  return new Feed({
    title: config.feedTitle,
    description: config.feedDescription,
    id: config.feedId,
    link: config.feedBaseUrl,
    language: config.feedLanguage,
    updated: updatedAt,
    generator: FEED_GENERATOR,
    copyright: config.feedCopyright,
    feedLinks: {
      atom: new URL(config.feedFileName, config.feedBaseUrl).href,
    },
    author: {
      name: config.authorName,
      email: config.authorEmail,
      link: config.authorUrl,
    },
  });
}

/** Process all meetings and their agenda items, adding them to the feed. */
function appendMeetingAgendaItems(feed: Feed, meetings: Meeting[], fallbackDate: Date): void {
  for (const meeting of meetings) {
    for (const item of meeting.agendaItem ?? []) {
      // Feed publication is intentionally opt-in: a missing flag must not expose
      // an item whose visibility the source did not establish.
      if (item.public !== true) continue;
      appendAgendaItem(feed, meeting, item, fallbackDate);
    }
  }
}

/** Resolve additional info for an agenda item's consultation from the local stores. */
function resolveAgendaItemPaperDetails(item: AgendaItem): {
  attachments: OParlFile[];
  paperLastUpdate?: Date;
} {
  const attachmentsById = new Map<string, OParlFile>();
  for (const file of item.auxiliaryFile ?? []) {
    attachmentsById.set(file.id, file);
  }
  let paperLastUpdate: Date | undefined;

  if (item.consultation) {
    const paper = stores.papers.getPaperByConsultationId(item.consultation);
    if (paper) {
      paperLastUpdate = latestValidDate(paper.modified, paper.created);

      for (const file of paper.auxiliaryFile ?? []) {
        attachmentsById.set(file.id, file);
      }
    }
  }

  return { attachments: [...attachmentsById.values()], paperLastUpdate };
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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeHttpUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** Render the HTML body shown for a single agenda-item entry. */
function renderEntryContent(
  meeting: Meeting,
  agendaItem: AgendaItem,
  meetingDay: string,
  attachmentHtml: string,
): string {
  return `
      <b>Sitzung:</b> ${escapeHtml(meeting.name)}<br>
      <b>Datum:</b> ${meetingDay}<br>
      <b>TOP ${escapeHtml(agendaItem.number ?? '')}:</b> ${escapeHtml(agendaItem.name)}<br><br>
      <b>Anhänge:</b><br> ${attachmentHtml}
    `;
}

/** Add an agenda item to the feed. */
function appendAgendaItem(
  feed: Feed,
  meeting: Meeting,
  agendaItem: AgendaItem,
  fallbackDate: Date,
): void {
  if (!agendaItem.number) return;

  const meetingId = meeting.id.split('/').pop() ?? '';
  const agendaItemUrl = `https://sitzungskalender.karlsruhe.de/db/ratsinformation/termin-${encodeURIComponent(meetingId)}#top${encodeURIComponent(agendaItem.number)}`;

  const { attachments, paperLastUpdate } = resolveAgendaItemPaperDetails(agendaItem);
  const attachmentHtml = attachments.map(formatAttachmentLink).join('');

  const itemCreated = parseValidDate(agendaItem.created);
  const itemModified = parseValidDate(agendaItem.modified);

  const meetingDay = formatGermanDate(parseValidDate(meeting.start), 'long');
  // `date` (Atom <updated>) and `published` must be valid Dates or the Atom serializer throws.
  // Prefer the meeting's own date over the generic fallback so a date-less agenda item still
  // sorts near its meeting rather than at the epoch floor.
  const mostRecentDate =
    latestValidDate(
      itemModified,
      itemCreated,
      meeting.modified,
      meeting.created,
      paperLastUpdate,
      ...attachments.flatMap((file) => [file.modified, file.created]),
    ) ??
    parseValidDate(meeting.start) ??
    fallbackDate;
  const publishedDate = itemCreated ?? itemModified ?? mostRecentDate;

  feed.addItem({
    title: escapeHtml(agendaItem.name),
    id: agendaItem.id,
    link: agendaItemUrl,
    author: [{ name: meeting.name }],
    description: escapeHtml(agendaItem.name),
    content: renderEntryContent(meeting, agendaItem, meetingDay, attachmentHtml),
    date: mostRecentDate,
    published: publishedDate,
  });
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
export async function buildAgendaFeed(
  meetings: Meeting[],
  fallbackDate: Date = FALLBACK_DATE,
): Promise<Feed> {
  logger.info('Starting to create feed...');
  const feed = createEmptyFeed(fallbackDate);
  appendMeetingAgendaItems(feed, meetings, fallbackDate);
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
  logger.info('Finished creating feed.');
  return feed;
}

/** Write the feed to the file system */
export async function writeFullFeed(feed: Feed): Promise<void> {
  const outputPath = await writeSerializedFeed(feed, config.feedFileName);
  logger.info(`Feed has been saved to ${outputPath}`);
}

/** Write a trimmed feed containing only the most recent items to the file system */
export async function writeRecentFeed(feed: Feed, maximumItemCount = 100): Promise<void> {
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

  const outputPath = await writeSerializedFeed(recentFeed, config.recentFeedFileName);
  logger.info(`Recent feed (last ${maximumItemCount} items) has been saved to ${outputPath}`);
}

async function writeSerializedFeed(feed: Feed, fileName: string): Promise<string> {
  // atomicWriteFile creates the parent directory, so no explicit mkdir is needed.
  const outputPath = docsPath(fileName);
  await atomicWriteFile(outputPath, feed.atom1());
  return outputPath;
}
