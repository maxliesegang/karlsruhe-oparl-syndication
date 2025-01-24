// src/app.ts
import { fetchAllMeetings, fetchAllOrganizations, fetchAllPapers } from './api';
import { createFeed, writeFeedToFile } from './feed';
import { config } from './config';
import { store } from './store';
import fs from 'fs/promises';

import { getLastUpdatedFromFeed } from './utils';
import { meetingStore } from './store/meeting-store';
import { paperStore } from './store/paper-store';
import { organizationStore } from './store/organization-store';

async function clearCache() {
  try {
    store.clearAllFromCache();
    await fs.rm(config.cacheDir, { recursive: true, force: true });
    console.log('Cache cleared.');
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

export async function fetchAndBuildFeed() {
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

    await fetchAllOrganizations(organizationStore.getLastModified());

    await fetchAllMeetings(meetingStore.getLastModified());
    const meetings = store.meetings.getAllItems();

    await fetchAllPapers(paperStore.getLastModified());

    const feed = await createFeed(meetings, newUpdated);
    await writeFeedToFile(feed);
    console.log(`Feed has been created and saved as ${config.feedFilename}.`);
    console.log('You can now run "npm run serve" to host the feed locally.');

    await store.saveAllToDisk();
  } catch (error) {
    console.error('Error in fetchDataAndCreateFeed:', error);
  }
}
