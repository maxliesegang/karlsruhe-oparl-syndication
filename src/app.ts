import { feedService } from './services';
import { shouldClearCache, clearCache } from './services/cache-service';

/**
 * Main entry point: fetches data from the OParl API and generates the Atom feed.
 */
export async function fetchAndBuildFeed(): Promise<void> {
  if (shouldClearCache()) {
    await clearCache();
  }

  await feedService.fetchDataAndGenerateFeed();
}
