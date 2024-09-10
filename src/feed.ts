// File: src/feed.ts
import { Feed } from 'feed';
import fs from 'fs/promises';
import path from 'path';
import { Meeting, AgendaItem, Paper } from './types';
import { config } from './config';
import { extractPdfText } from './pdf';
import { correctUrl } from './utils';
import { store } from './store';
import { DEFAULT_LANGUAGE, FEED_GENERATOR } from './constants';

export async function createFeed(
  meetings: Meeting[],
  newUpdated: Date,
  lastUpdated?: Date,
): Promise<Feed> {
  console.log('Starting to create feed...');

  const feed = new Feed({
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

  console.log(`Processing ${meetings.length} meetings...`);
  let processedItems = 0;
  const totalItems = meetings.reduce((sum, meeting) => sum + (meeting.agendaItem?.length || 0), 0);

  for (const meeting of meetings) {
    if (!meeting.agendaItem) continue;
    await Promise.all(
      meeting.agendaItem.map(async (item) => {
        await addItemToFeed(feed, meeting, item);
        processedItems++;
      }),
    );
  }

  console.log('Finished creating feed.');
  return feed;
}

async function getAdditionalInfo(
  item: AgendaItem,
): Promise<{ auxiliaryFileInfo: string; pdfContents: string; paperLastUpdate: Date | null }> {
  let auxiliaryFileInfo = '';
  let pdfContents = '';
  let paperLastUpdate: Date | null = null;

  if (item.consultation) {
    try {
      const paper = store.papers.getPaperByConsultationId(item.consultation);
      if (paper) {
        const lastUpdateDate = paper.modified || paper.created;
        if (lastUpdateDate) {
          paperLastUpdate = new Date(lastUpdateDate);
        }

        if (paper.auxiliaryFile && paper.auxiliaryFile.length > 0) {
          const pdfPromises = paper.auxiliaryFile.map(async (file) => {
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

            auxiliaryFileInfo += `<a href="${correctedUrl}">${file.name} (Erstellt am: ${createdDate}, Aktualisiert am: ${modifiedDate})</a><br>`;

            if (config.extractPdfText) {
              const pdfData = await extractPdfText(correctedUrl);
              if (pdfData) {
                return `<br>Datei: ${file.name}<br>${pdfData.text}<br>`;
              }
            }
            return '';
          });

          const pdfResults = await Promise.all(pdfPromises);
          pdfContents = pdfResults.join('');
        }
      }
    } catch (error) {
      console.error('Error fetching additional data:', error);
    }
  }

  return { auxiliaryFileInfo, pdfContents, paperLastUpdate };
}

async function addItemToFeed(feed: Feed, meeting: Meeting, item: AgendaItem): Promise<void> {
  if (!item.number || item.number === null) return;

  const meetingLastPath = meeting.id.split('/').pop();
  const relativePath = item.number ? `#top${item.number}` : '';
  const itemLink = `https://sitzungskalender.karlsruhe.de/db/ratsinformation/termin-${meetingLastPath}${relativePath}`;

  const { auxiliaryFileInfo, pdfContents, paperLastUpdate } = await getAdditionalInfo(item);

  const meetingDay = new Date(meeting.start).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Determine the most recent date
  const itemModified = new Date(item.modified);
  const itemCreated = new Date(item.created);
  const dates = [itemModified, itemCreated];
  if (paperLastUpdate) {
    dates.push(paperLastUpdate);
  }
  const mostRecentDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  feed.addItem({
    title: item.name,
    id: item.id,
    link: itemLink,
    author: [{ name: meeting.name }],
    description: item.name,
    content: `<b>Sitzung:</b> ${meeting.name}<br>
      <b>Datum:</b> ${meetingDay}<br>
      <b>TOP ${item.number}:</b> ${item.name}<br><br><br>
      <b>Anhänge:</b><br>
      ${auxiliaryFileInfo}
      <br><br><br>
      <b>PDF Inhalte</b>:
      ${pdfContents}
      `,
    date: mostRecentDate,
    published: new Date(item.created),
  });
}

export async function writeFeedToFile(feed: Feed): Promise<void> {
  const atomFeed = feed.atom1();
  const publicDir = path.join(__dirname, '..', 'docs');
  await fs.mkdir(publicDir, { recursive: true });
  const outputPath = path.join(publicDir, config.feedFilename);
  await fs.writeFile(outputPath, atomFeed, { encoding: 'utf8', flag: 'w' });
  console.log(`Feed has been saved to ${outputPath}`);
}
