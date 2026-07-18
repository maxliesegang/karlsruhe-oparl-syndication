import { Feed } from 'feed';
import fs from 'fs/promises';
import path from 'path';
import { AgendaItem, AuxiliaryFile, Meeting } from './types/index.js';
import { config } from './config.js';
import { correctUrl, latestValidDate, parseValidDate } from './utils.js';
import { store } from './store/index.js';
import { FEED_GENERATOR } from './constants.js';
import { logger } from './logger.js';
import { atomicWriteFile } from './file-utils.js';

/** Initialize a new feed with given metadata */
async function initializeFeed(newUpdated: Date): Promise<Feed> {
  return new Feed({
    title: config.feedTitle,
    description: config.feedDescription,
    id: config.feedId,
    link: config.feedLink,
    language: config.feedLanguage,
    updated: newUpdated,
    generator: FEED_GENERATOR,
    copyright: config.feedCopyright,
    feedLinks: {
      atom: new URL(config.feedFilename, config.feedLink).href,
    },
    author: {
      name: config.authorName,
      email: config.authorEmail,
      link: config.authorLink,
    },
  });
}

/** Process all meetings and their agenda items, adding them to the feed */
async function addMeetingsToFeed(feed: Feed, meetings: Meeting[]): Promise<void> {
  for (const meeting of meetings) {
    if (!meeting.agendaItem) continue;

    await Promise.all(
      meeting.agendaItem.map(async (item) => {
        await addItemToFeed(feed, meeting, item);
      }),
    );
  }
}

/** Fetch additional info for a given agenda item related to its consultation */
async function fetchAgendaItemDetails(
  item: AgendaItem,
): Promise<{ auxiliaryFileInfo: string; paperLastUpdate: Date | null }> {
  let auxiliaryFileInfo = '';
  let paperLastUpdate: Date | null = null;

  if (item.consultation) {
    const paper = await fetchPaperByConsultationId(item.consultation);
    if (paper) {
      paperLastUpdate = latestValidDate(paper.modified, paper.created) ?? null;

      if (paper.auxiliaryFile?.length) {
        const pdfPromises = paper.auxiliaryFile.map(async (file) => formatFileDates(file));
        auxiliaryFileInfo = (await Promise.all(pdfPromises)).join('');
      }
    }
  }

  return { auxiliaryFileInfo, paperLastUpdate };
}

/** Fetch paper data by consultation ID, with error handling */
async function fetchPaperByConsultationId(consultationId: string) {
  try {
    return store.papers.getPaperByConsultationId(consultationId);
  } catch (error) {
    logger.error(`Error fetching paper for consultation ID ${consultationId}:`, error);
    return null;
  }
}

/** Format a short numeric 'de-DE' date, or a placeholder when the date is missing/invalid */
function formatGermanDate(date: Date | undefined): string {
  if (!date) return 'unbekannt';
  return date.toLocaleDateString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** Format auxiliary file metadata for display */
function formatFileDates(file: AuxiliaryFile): string {
  const correctedUrl = correctUrl(file.downloadUrl);
  const createdDate = formatGermanDate(parseValidDate(file.created));
  const modifiedDate = formatGermanDate(parseValidDate(file.modified));

  return `<a href="${correctedUrl}">${file.name} (Erstellt am: ${createdDate}, Aktualisiert am: ${modifiedDate})</a><br>`;
}

/** Format a meeting date to 'de-DE' locale, or a placeholder when the date is missing/invalid */
function formatMeetingDayForLocale(date: Date | undefined): string {
  if (!date) return 'unbekannt';
  return date.toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Add an agenda item to the feed */
async function addItemToFeed(feed: Feed, meeting: Meeting, item: AgendaItem): Promise<void> {
  if (!item.number) return;

  const meetingLastPath = meeting.id.split('/').pop();
  const itemLink = `https://sitzungskalender.karlsruhe.de/db/ratsinformation/termin-${meetingLastPath}#top${item.number}`;

  const { auxiliaryFileInfo, paperLastUpdate } = await fetchAgendaItemDetails(item);

  const itemCreated = parseValidDate(item.created);
  const itemModified = parseValidDate(item.modified);

  const meetingDay = formatMeetingDayForLocale(parseValidDate(meeting.start));
  // `date` (Atom <updated>) and `published` must be valid Dates or the Atom serializer throws.
  const mostRecentDate = latestValidDate(itemModified, itemCreated, paperLastUpdate) ?? new Date();
  const publishedDate = itemCreated ?? itemModified ?? mostRecentDate;

  feed.addItem({
    title: item.name,
    id: item.id,
    link: itemLink,
    author: [{ name: meeting.name }],
    description: item.name,
    content: `
      <b>Sitzung:</b> ${meeting.name}<br>
      <b>Datum:</b> ${meetingDay}<br>
      <b>TOP ${item.number}:</b> ${item.name}<br><br>
      <b>Anhänge:</b><br> ${auxiliaryFileInfo}
    `,
    date: mostRecentDate,
    published: publishedDate,
  });
}

/** The most recent entry date in the feed, or undefined when the feed has no entries. */
function latestEntryDate(feed: Feed): Date | undefined {
  let latest: Date | undefined;
  for (const item of feed.items) {
    if (item.date && (!latest || item.date.getTime() > latest.getTime())) {
      latest = item.date;
    }
  }
  return latest;
}

/** Create the feed with metadata and meetings */
export async function createFeed(meetings: Meeting[], fallbackUpdated: Date): Promise<Feed> {
  logger.info('Starting to create feed...');
  const feed = await initializeFeed(fallbackUpdated);
  await addMeetingsToFeed(feed, meetings);
  // Anchor the feed-level <updated> to the newest entry rather than the run clock, so an
  // unchanged run produces a byte-identical feed. That lets git dedupe the blob and lets
  // subscribers' readers get a 304 instead of re-downloading the whole feed every poll.
  // Falls back to the run time only when the feed is empty.
  feed.options.updated = latestEntryDate(feed) ?? fallbackUpdated;
  logger.info('Finished creating feed.');
  return feed;
}

/** Write the feed to the file system */
export async function writeFeedToFile(feed: Feed): Promise<void> {
  const atomFeed = feed.atom1();
  const publicDir = path.join(import.meta.dirname, '..', 'docs');
  await fs.mkdir(publicDir, { recursive: true });
  const outputPath = path.join(publicDir, config.feedFilename);
  await atomicWriteFile(outputPath, atomFeed);
  logger.info(`Feed has been saved to ${outputPath}`);
}

/** Write a trimmed feed containing only the most recent items to the file system */
export async function writeTrimmedFeedToFile(feed: Feed, limit = 50): Promise<void> {
  const recentFeedUrl = new URL(config.feedFilenameRecent, config.feedLink).href;
  const trimmedFeed = new Feed({
    ...feed.options,
    id: recentFeedUrl,
    feedLinks: { atom: recentFeedUrl },
    description: feed.options.description ?? '',
    link: feed.options.link ?? '',
    copyright: feed.options.copyright ?? '',
  });

  const recentItems = [...feed.items]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, limit);

  for (const item of recentItems) {
    trimmedFeed.addItem(item);
  }

  const atomFeed = trimmedFeed.atom1();
  const publicDir = path.join(import.meta.dirname, '..', 'docs');
  await fs.mkdir(publicDir, { recursive: true });
  const outputPath = path.join(publicDir, config.feedFilenameRecent);
  await atomicWriteFile(outputPath, atomFeed);
  logger.info(`Trimmed feed (last ${limit} items) has been saved to ${outputPath}`);
}
