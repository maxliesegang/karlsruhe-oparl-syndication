// src/app.ts
import { feedService, cacheService } from './services';

/**
 * Main function to fetch data and build the feed
 * This function orchestrates the entire process using the specialized services
 */
export async function fetchAndBuildFeed() {
  try {
    // Check if we should clear the cache first
    if (cacheService.shouldClearCache()) {
      await cacheService.clearCache();
    }

    // Execute the feed generation process
    await feedService.fetchDataAndGenerateFeed();
  } catch (error) {
    console.error('Error in fetchAndBuildFeed:', error);
  }
}
