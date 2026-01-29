import { Feed } from 'feed';
import fs from 'fs/promises';
import path from 'path';
import { AgendaItem, AuxiliaryFile, Meeting } from './types';
import { config } from './config';
import { correctUrl } from './utils';
import { store } from './store';
import { DEFAULT_LANGUAGE, FEED_GENERATOR } from './constants';
import { logger } from './logger';

/** Initialize a new feed with given metadata */
async function initializeFeed(newUpdated: Date): Promise<Feed> {
  return new Feed({
    title: config.feedTitle,
    description: config.feedDescription,
    id: config.feedId,
    link: config.feedLink,
    language: DEFAULT_LANGUAGE,
    updated: newUpdated,
    generator: FEED_GENERATOR,
    copyright: config.feedCopyright,
    feedLinks: {
      atom: `${config.feedLink}${config.feedFilename}`,
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
      const lastUpdateDate = paper.modified || paper.created;
      if (lastUpdateDate) {
        paperLastUpdate = new Date(lastUpdateDate);
      }

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

/** Format auxiliary file metadata for display */
function formatFileDates(file: AuxiliaryFile): string {
  const correctedUrl = correctUrl(file.downloadUrl);
  const createdDate = new Date(file.created).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const modifiedDate = new Date(file.modified).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return `<a href="${correctedUrl}">${file.name} (Erstellt am: ${createdDate}, Aktualisiert am: ${modifiedDate})</a><br>`;
}

/** Get the most recent date from various date sources (agenda item and consultation paper) */
function getMostRecentDate(
  itemCreated: Date,
  itemModified: Date,
  paperLastUpdate: Date | null,
): Date {
  const dates = [itemModified, itemCreated];
  if (paperLastUpdate) {
    dates.push(paperLastUpdate);
  }
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

/** Format a meeting date to 'de-DE' locale */
function formatMeetingDayForLocale(date: Date): string {
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

  const meetingDay = formatMeetingDayForLocale(new Date(meeting.start));
  const mostRecentDate = getMostRecentDate(
    new Date(item.created),
    new Date(item.modified),
    paperLastUpdate,
  );

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
    published: new Date(item.created),
  });
}

/** Create the feed with metadata and meetings */
export async function createFeed(meetings: Meeting[], newUpdated: Date): Promise<Feed> {
  logger.info('Starting to create feed...');
  const feed = await initializeFeed(newUpdated);
  await addMeetingsToFeed(feed, meetings);
  logger.info('Finished creating feed.');
  return feed;
}

/** Write the feed to the file system */
export async function writeFeedToFile(feed: Feed): Promise<void> {
  const atomFeed = feed.atom1();
  const publicDir = path.join(import.meta.dirname, '..', 'docs');
  await fs.mkdir(publicDir, { recursive: true });
  const outputPath = path.join(publicDir, config.feedFilename);
  await fs.writeFile(outputPath, atomFeed, { encoding: 'utf8', flag: 'w' });
  logger.info(`Feed has been saved to ${outputPath}`);
}
