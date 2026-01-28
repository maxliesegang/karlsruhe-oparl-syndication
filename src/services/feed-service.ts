import { store } from '../store';
import { createFeed, writeFeedToFile } from '../feed';
import { fetchAllMeetings, fetchAllOrganizations, fetchAllPapers } from '../api';
import { meetingStore } from '../store/meeting-store';
import { paperStore } from '../store/paper-store';
import { config } from '../config';
import { loadFromDisk, saveToDisk } from './cache-service';
import { logger } from '../logger';

/** Fetches all data from the OParl API */
async function fetchAllData(): Promise<void> {
  logger.info('Fetching data from OParl API...');

  await fetchAllOrganizations();
  await fetchAllMeetings(meetingStore.getLastModifiedWithSafetyMargin());
  await fetchAllPapers(paperStore.getLastModifiedWithSafetyMargin());

  logger.info('Finished fetching data.');
}

/** Generates and saves the Atom feed */
async function generateFeed(): Promise<void> {
  logger.info('Generating feed...');

  const meetings = store.meetings.getAllItems();
  const feed = await createFeed(meetings, new Date());
  await writeFeedToFile(feed);

  logger.info(`Feed saved as ${config.feedFilename}`);
}

/**
 * Orchestrates the full feed generation pipeline:
 * 1. Load cached data from disk
 * 2. Fetch updates from the API
 * 3. Generate and save the feed
 * 4. Persist updated data to disk
 */
export async function fetchDataAndGenerateFeed(): Promise<void> {
  await loadFromDisk();
  await fetchAllData();
  await generateFeed();
  await saveToDisk();
}

// For backwards compatibility with existing imports
export const feedService = { fetchDataAndGenerateFeed };
