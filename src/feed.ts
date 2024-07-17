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
): Promise<{ auxiliaryFileInfo: string; pdfContents: string }> {
  let auxiliaryFileInfo = '';
  let pdfContents = '';

  if (item.consultation) {
    try {
      const paper = store.papers.getPaperByConsultationId(item.consultation);
      if (paper && paper.auxiliaryFile && paper.auxiliaryFile.length > 0) {
        const pdfPromises = paper.auxiliaryFile.map(async (file) => {
          const correctedUrl = correctUrl(file.downloadUrl);
          auxiliaryFileInfo += `<a href="${correctedUrl}">${file.name}</a><br>`;

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
    } catch (error) {
      console.error('Error fetching additional data:', error);
    }
  }

  return { auxiliaryFileInfo, pdfContents };
}

async function addItemToFeed(feed: Feed, meeting: Meeting, item: AgendaItem): Promise<void> {
  if (!item.number || item.number === null) return;

  const meetingLastPath = meeting.id.split('/').pop();
  const relativePath = item.number ? `#top${item.number}` : '';
  const itemLink = `https://sitzungskalender.karlsruhe.de/db/ratsinformation/termin-${meetingLastPath}${relativePath}`;

  const { auxiliaryFileInfo, pdfContents } = await getAdditionalInfo(item);

  const meetingDay = new Date(meeting.start).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

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
    date: new Date(item.modified),
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
