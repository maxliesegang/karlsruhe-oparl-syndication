import fs from 'fs/promises';
import path from 'path';
import { extractRecordId, sanitizeRecordId } from '../file-utils.js';

/** Keeps bulk filesystem work fast without exhausting the process file limit. */
export const FILE_OPERATION_CONCURRENCY = 16;

export async function mapInBatches<T, R>(
  items: readonly T[],
  operation: (item: T) => Promise<R>,
  batchSize = FILE_OPERATION_CONCURRENCY,
): Promise<R[]> {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError('batchSize must be a positive integer');
  }

  const results: R[] = [];
  for (let offset = 0; offset < items.length; offset += batchSize) {
    results.push(...(await Promise.all(items.slice(offset, offset + batchSize).map(operation))));
  }
  return results;
}

/** Returns the stable, filesystem-safe basename used by all per-record stores. */
export function recordBasename(id: string): string {
  return sanitizeRecordId(extractRecordId(id));
}

export function recordFileName(id: string, extension = 'json'): string {
  return `${recordBasename(id)}.${extension}`;
}

/**
 * Builds a filename-to-id index and rejects lossy sanitization collisions before
 * any writes occur. Keeping this rule shared prevents stores from subtly
 * disagreeing about which records are safe to persist.
 */
export function indexRecordFileNames(
  storeName: string,
  ids: Iterable<string>,
): Map<string, string> {
  const files = new Map<string, string>();

  for (const id of ids) {
    const filename = recordFileName(id);
    const existingId = files.get(filename);
    if (existingId !== undefined && existingId !== id) {
      throw new Error(
        `${storeName}: filename collision on ${filename} (ids ${existingId} and ${id}); ` +
          'two records sanitize to the same file',
      );
    }
    files.set(filename, id);
  }

  return files;
}

/** Lists JSON records, or null when the directory does not exist. */
export async function readJsonFileNames(directory: string): Promise<string[] | null> {
  try {
    const entries = await fs.readdir(directory);
    return entries.filter((entry) => entry.endsWith('.json'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** Removes JSON records not present in the current store and returns their count. */
export async function removeOrphanJsonFiles(
  directory: string,
  currentFiles: { has(filename: string): boolean },
): Promise<number> {
  const storedFiles = await fs.readdir(directory);
  const orphans = storedFiles.filter(
    (filename) => filename.endsWith('.json') && !currentFiles.has(filename),
  );
  await mapInBatches(orphans, (filename) => fs.unlink(path.join(directory, filename)));
  return orphans.length;
}
