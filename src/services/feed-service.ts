import { store } from '../store/index.js';
import { createFeed, writeFeedToFile, writeTrimmedFeedToFile } from '../feed.js';
import { fetchAllMeetings, fetchAllOrganizations, fetchAllPapers } from '../api/index.js';
import { config } from '../config.js';
import { analyzeStadtteile } from './stadtteil-service.js';
import { logger } from '../logger.js';

async function fetchAllData(): Promise<void> {
  logger.info('Fetching data from OParl API...');
  await fetchAllOrganizations();
  await fetchAllMeetings(store.meetings.getLastModifiedWithSafetyMargin());
  await fetchAllPapers(store.papers.getLastModifiedWithSafetyMargin());
  logger.info('Finished fetching data.');
}

async function generateFeed(): Promise<void> {
  logger.info('Generating feed...');
  const meetings = store.meetings.getAllItems();
  const feed = await createFeed(meetings, new Date());
  await writeFeedToFile(feed);
  await writeTrimmedFeedToFile(feed);
  logger.info(`Feed saved as ${config.feedFilename} and ${config.feedFilenameRecent}`);
}

/**
 * Orchestrates the full feed generation pipeline:
 * 1. Load cached data from disk
 * 2. Fetch updates from the API
 * 3. Generate and save the feed
 * 4. Persist updated data to disk
 */
export async function fetchDataAndGenerateFeed(): Promise<void> {
  await store.loadAllFromDisk();
  logger.info('Loaded store data from disk');
  await fetchAllData();
  await generateFeed();
  await store.saveAllToDisk();
  logger.info('Saved store data to disk');
  await analyzeStadtteile();
}
