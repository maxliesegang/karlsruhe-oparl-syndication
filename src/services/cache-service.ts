import { store } from '../store';

/** Checks if the --clear-cache flag was passed */
export function shouldClearCache(): boolean {
  return process.argv.includes('--clear-cache');
}

/** Clears all in-memory data stores */
export async function clearCache(): Promise<void> {
  store.clearAllFromCache();
  console.log('Cache cleared');
}

/** Loads all persisted data from disk into memory */
export async function loadFromDisk(): Promise<void> {
  await store.loadAllFromDisk();
  console.log('Loaded store data from disk');
}

/** Saves all in-memory data to disk */
export async function saveToDisk(): Promise<void> {
  await store.saveAllToDisk();
  console.log('Saved store data to disk');
}
