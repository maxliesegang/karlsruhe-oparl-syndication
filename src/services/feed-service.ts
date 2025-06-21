import { store } from '../store';
import { createFeed, writeFeedToFile } from '../feed';
import { fetchAllMeetings, fetchAllOrganizations, fetchAllPapers } from '../api';
import { meetingStore } from '../store/meeting-store';
import { paperStore } from '../store/paper-store';
import { organizationStore } from '../store/organization-store';
import { getLastUpdatedFromFeed } from '../utils';
import { config } from '../config';
import { cacheService } from './cache-service';

/**
 * Service responsible for orchestrating the feed generation process
 */
export class FeedService {
  /**
   * Fetches all required data from the API
   * @param lastUpdated Optional date to fetch only data modified since that date
   */
  async fetchAllData(lastUpdated?: Date): Promise<void> {
    console.log('Starting to fetch all data...');

    await fetchAllOrganizations(organizationStore.getLastModified());
    await fetchAllMeetings(meetingStore.getLastModified());
    await fetchAllPapers(paperStore.getLastModified());

    console.log('Finished fetching all data.');
  }

  /**
   * Generates and saves the feed file
   * @param newUpdated The date to use as the feed's updated date
   */
  async generateAndSaveFeed(newUpdated: Date): Promise<void> {
    console.log('Starting feed generation process...');

    const meetings = store.meetings.getAllItems();
    const feed = await createFeed(meetings, newUpdated);
    await writeFeedToFile(feed);

    console.log(`Feed has been created and saved as ${config.feedFilename}.`);
    console.log('You can now run "npm run serve" to host the feed locally.');
  }

  /**
   * Determines the last updated date from the existing feed
   * @returns The last updated date or undefined if not available or if fetchAllPages is true
   */
  async getLastUpdatedDate(): Promise<Date | undefined> {
    if (config.fetchAllPages) {
      return undefined;
    }

    const lastUpdated = await getLastUpdatedFromFeed();
    if (lastUpdated) {
      console.log(`Last updated date from feed: ${lastUpdated}`);
    }

    return lastUpdated;
  }

  /**
   * Orchestrates the entire process of fetching data and generating the feed
   */
  async fetchDataAndGenerateFeed(): Promise<void> {
    try {
      // Load data from disk using the cache service
      await cacheService.loadFromDisk();

      const newUpdated = new Date();
      const lastUpdated = await this.getLastUpdatedDate();

      await this.fetchAllData(lastUpdated);
      await this.generateAndSaveFeed(newUpdated);

      // Save data to disk using the cache service
      await cacheService.saveToDisk();
    } catch (error) {
      console.error('Error in fetchDataAndGenerateFeed:', error);
    }
  }
}

export const feedService = new FeedService();
