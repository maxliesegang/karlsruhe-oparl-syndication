import fs from 'fs/promises';
import path from 'path';
import { recordFileName } from '../docs-files.js';
import { logger } from '../logger.js';

/** Keeps bulk filesystem work fast without exhausting the process file limit. */
export const FILE_OPERATION_CONCURRENCY = 16;

/**
 * Below this count, orphan removals are always allowed. Normal add-only runs
 * remove nothing; tombstones remove a handful, so a small absolute floor keeps
 * ordinary maintenance from ever tripping the guard.
 */
export const ORPHAN_SWEEP_ABSOLUTE_FLOOR = 100;
/**
 * Above the absolute floor, refuse to remove more than this fraction of the
 * records that existed before the run. Removing a large share signals a bug or a
 * truncated crawl (e.g. a --clear-cache run against a stale directory), which in
 * an add-only archive we never want to silently delete-and-commit.
 */
export const ORPHAN_SWEEP_MAX_RATIO = 0.1;

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

/**
 * Builds a filename-to-id index and rejects lossy sanitization collisions before
 * any writes occur. Keeping this rule shared prevents stores from subtly
 * disagreeing about which records are safe to persist.
 */
export function buildRecordFileNameIndex(
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
export async function listJsonFileNames(directory: string): Promise<string[] | null> {
  try {
    const entries = await fs.readdir(directory);
    return entries.filter((entry) => entry.endsWith('.json'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * Reads a legacy monolithic `docs/<entity>.json` array for the one-time cutover
 * to per-record files. Returns null when the file is absent (nothing to migrate)
 * or does not hold an array, so both callers treat "no legacy data" identically
 * instead of each re-deriving the ENOENT and shape checks.
 */
export async function readLegacyRecordArray<T>(filePath: string): Promise<T[] | null> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }

  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed) ? (parsed as T[]) : null;
}

/**
 * Aborts the sweep when it would remove an implausibly large share of the
 * archive, protecting an add-only store from a bug or a truncated crawl silently
 * deleting (and committing) thousands of records. Throwing here fails the whole
 * run before the destructive unlink, leaving every file intact.
 */
export function assertOrphanSweepWithinGuard(
  storeName: string,
  orphanCount: number,
  priorRecordCount: number,
): void {
  if (orphanCount <= ORPHAN_SWEEP_ABSOLUTE_FLOOR) return;
  const allowed = Math.floor(Math.max(priorRecordCount, 0) * ORPHAN_SWEEP_MAX_RATIO);
  if (orphanCount > allowed) {
    throw new Error(
      `${storeName}: refusing to remove ${orphanCount} orphan file(s) — ` +
        `more than ${Math.round(ORPHAN_SWEEP_MAX_RATIO * 100)}% of the ${priorRecordCount} ` +
        'record(s) present before this run. Aborting to protect the archive. If this ' +
        'deletion is intentional, delete the directory and re-run with --clear-cache.',
    );
  }
}

/**
 * Removes JSON records not present in the current store and returns their count.
 * When `guard` is supplied, an implausibly large removal aborts the run instead
 * of deleting (see {@link assertOrphanSweepWithinGuard}).
 */
export async function removeOrphanJsonFiles(
  directory: string,
  currentFiles: { has(filename: string): boolean },
  guard?: { storeName: string; priorRecordCount: number },
): Promise<number> {
  const storedFiles = await fs.readdir(directory);
  const orphans = storedFiles.filter(
    (filename) => filename.endsWith('.json') && !currentFiles.has(filename),
  );
  if (guard) {
    assertOrphanSweepWithinGuard(guard.storeName, orphans.length, guard.priorRecordCount);
    if (orphans.length > 0) {
      logger.warn(`${guard.storeName}: sweeping ${orphans.length} orphan file(s)`);
    }
  }
  await mapInBatches(orphans, (filename) => fs.unlink(path.join(directory, filename)));
  return orphans.length;
}
