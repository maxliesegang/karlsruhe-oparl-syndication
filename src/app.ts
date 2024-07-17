// src/app.ts
import { fetchAllMeetings, fetchAllOrganizations, fetchAllPapers } from './api';
import { createFeed, writeFeedToFile } from './feed';
import { config } from './config';
import { store } from './store';
import fs from 'fs/promises';

import { getLastUpdatedFromFeed } from './utils';

async function clearCache() {
  if (config.useCache) {
    try {
      await fs.rm(config.cacheDir, { recursive: true, force: true });
      console.log('Cache cleared.');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
}

export async function fetchDataAndCreateFeed() {
  try {
    if (process.argv.includes('--clear-cache')) {
      await clearCache();
    }

    await store.loadAllFromDisk();
    console.log('Loaded all store data from disk');

    const newUpdated = new Date();
    const lastUpdated = config.fetchAllPages ? undefined : await getLastUpdatedFromFeed();
    if (lastUpdated) {
      console.log(`Last updated date from feed: ${lastUpdated}`);
    }

    console.log('Fetching all organizations...');
    await fetchAllOrganizations(lastUpdated);
    console.log(`Fetched a total of ${store.organizations.getAll().length} organizations`);

    console.log('Fetching all meetings...');
    await fetchAllMeetings(lastUpdated);
    const meetings = store.meetings.getAll();
    console.log(`Fetched a total of ${store.meetings.getAll().length} meetings`);

    console.log('Fetching all papers...');
    await fetchAllPapers(lastUpdated);
    console.log(`Fetched a total of ${store.papers.getAll().length} papers`);

    const feed = await createFeed(meetings, newUpdated);
    await writeFeedToFile(feed);
    console.log(`Feed has been created and saved as ${config.feedFilename}.`);
    console.log('You can now run "npm run serve" to host the feed locally.');

    await store.saveAllToDisk();
    console.log('Saved all store data to disk');
  } catch (error) {
    console.error('Error in fetchDataAndCreateFeed:', error);
  }
}
