import fs from 'fs/promises';
import { store } from '../store';
import { config } from '../config';

/**
 * Service responsible for managing the application cache
 */
export class CacheService {
  /**
   * Clears all data from the in-memory cache and removes the cache directory
   */
  async clearCache(): Promise<void> {
    try {
      store.clearAllFromCache();
      await fs.rm(config.cacheDir, { recursive: true, force: true });
      console.log('Cache cleared.');
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }

  /**
   * Loads all data from disk into the in-memory cache
   */
  async loadFromDisk(): Promise<void> {
    try {
      await store.loadAllFromDisk();
      console.log('Loaded all store data from disk');
    } catch (error) {
      console.error('Error loading data from disk:', error);
      throw error;
    }
  }

  /**
   * Saves all data from the in-memory cache to disk
   */
  async saveToDisk(): Promise<void> {
    try {
      await store.saveAllToDisk();
      console.log('Saved all store data to disk');
    } catch (error) {
      console.error('Error saving data to disk:', error);
      throw error;
    }
  }

  /**
   * Checks if the cache should be cleared based on command line arguments
   * @returns True if the cache should be cleared, false otherwise
   */
  shouldClearCache(): boolean {
    return process.argv.includes('--clear-cache');
  }
}

export const cacheService = new CacheService();
