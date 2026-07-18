import fs from 'fs/promises';
import path from 'path';
import { BaseStore } from './base-store.js';
import {
  atomicWriteFile,
  canonicalStringify,
  docsPath,
  extractRecordId,
  sanitizeRecordId,
} from '../file-utils.js';
import { logger } from '../logger.js';

/**
 * Persists each record to its own `docs/<entity>/<recordId>.json` file instead
 * of one monolithic array. Because the whole archive is committed to git and
 * regenerated twice daily, per-record files let git store a new blob only for
 * records that actually changed, eliminating the history bloat that came from
 * rewriting a multi-megabyte file every run.
 *
 * Serialization is canonical (see {@link canonicalStringify}) so an unchanged
 * record is byte-identical run over run, and only records whose serialization
 * differs from what was loaded are rewritten (dirty tracking).
 */
export abstract class PerRecordStore<T extends { id: string }> extends BaseStore<T> {
  private readonly dirtyIds: Set<string> = new Set();
  private initialLoadCount = 0;

  /** Sub-directory under docs/ that holds the per-record files (e.g. "papers"). */
  abstract getDirName(): string;

  /**
   * Optional base directory override, used only by tests so persistence never
   * touches the real docs/ tree. Production stores leave this undefined and
   * resolve against the published docs directory.
   */
  constructor(private readonly baseDir?: string) {
    super();
  }

  private recordsDirectory(): string {
    return this.baseDir ? path.join(this.baseDir, this.getDirName()) : docsPath(this.getDirName());
  }

  private legacyFilePath(): string {
    return this.baseDir ? path.join(this.baseDir, this.getFileName()) : docsPath(this.getFileName());
  }

  private recordFileName(item: T): string {
    return `${sanitizeRecordId(extractRecordId(item.id))}.json`;
  }

  override add(item: T): void {
    if ((item as T & { deleted?: boolean }).deleted) {
      // Tombstone: BaseStore.add routes this to removeById.
      super.add(item);
      return;
    }
    const existing = this.itemStore.get(item.id);
    if (!existing || canonicalStringify(existing) !== canonicalStringify(item)) {
      this.dirtyIds.add(item.id);
    }
    super.add(item);
  }

  override removeById(id: string): boolean {
    const removed = super.removeById(id);
    if (removed) {
      // No record left to write; its file is unlinked by orphan cleanup on the
      // next persist (a removed record is, by definition, an orphan).
      this.dirtyIds.delete(id);
    }
    return removed;
  }

  override clearAllItems(): void {
    super.clearAllItems();
    this.dirtyIds.clear();
  }

  override async persistItemsToFile(): Promise<void> {
    const dir = this.recordsDirectory();
    await fs.mkdir(dir, { recursive: true });

    const items = this.getAllItems();

    // Map every current record to its filename, failing loudly on any collision
    // rather than silently overwriting one record with another.
    const currentFiles = new Set<string>();
    for (const item of items) {
      const filename = this.recordFileName(item);
      if (currentFiles.has(filename)) {
        throw new Error(
          `${this.getDirName()}: filename collision on ${filename} (id ${item.id}); ` +
            'two records sanitize to the same file',
        );
      }
      currentFiles.add(filename);
    }

    // Write only the records that changed this run.
    let written = 0;
    for (const item of items) {
      if (!this.dirtyIds.has(item.id)) continue;
      await atomicWriteFile(path.join(dir, this.recordFileName(item)), canonicalStringify(item));
      written++;
    }

    // Remove orphans only after every write has succeeded, so an interrupted
    // write never triggers destructive deletion (mirrors the chunk cleanup in
    // file-content-store). Under normal add-only runs this is a no-op; it only
    // removes files after tombstones or a --clear-cache full rebuild.
    const stored = await fs.readdir(dir);
    const orphans = stored.filter((f) => f.endsWith('.json') && !currentFiles.has(f));
    await Promise.all(orphans.map((f) => fs.unlink(path.join(dir, f))));

    // One-time migration cutover: once per-record files exist, the legacy
    // monolithic file is obsolete. force:true makes this a no-op when absent.
    await fs.rm(this.legacyFilePath(), { force: true });

    const total = items.length;
    const added = total - this.initialLoadCount;
    logger.info(
      `${this.getDirName()}/: ${written} written, ${orphans.length} removed, ` +
        `${added} added (${this.initialLoadCount} -> ${total})`,
    );

    this.dirtyIds.clear();
    this.initialLoadCount = total;
  }

  override async loadItemsFromFile(): Promise<void> {
    const dir = this.recordsDirectory();
    const files = await readJsonFileNames(dir);

    if (files !== null) {
      for (const filename of files) {
        const raw = await fs.readFile(path.join(dir, filename), 'utf8');
        const item = JSON.parse(raw) as T;
        this.itemStore.set(item.id, item);
        this.onItemLoad(item);
      }
      this.initialLoadCount = this.itemStore.size;
      logger.info(`Loaded ${this.itemStore.size} records from ${this.getDirName()}/`);
      return;
    }

    await this.migrateFromLegacyFile();
  }

  /**
   * Loads the legacy `docs/<entity>.json` array when the per-record directory
   * does not yet exist, marking every record dirty so the next persist writes
   * the full per-record layout and deletes the legacy file. One-time cutover.
   */
  private async migrateFromLegacyFile(): Promise<void> {
    let raw: string;
    try {
      raw = await fs.readFile(this.legacyFilePath(), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw error;
    }

    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return;

    for (const item of data as T[]) {
      this.itemStore.set(item.id, item);
      this.onItemLoad(item);
      this.dirtyIds.add(item.id);
    }
    this.initialLoadCount = this.itemStore.size;
    logger.info(
      `Migrating ${this.itemStore.size} records from legacy ${this.getFileName()} ` +
        `to ${this.getDirName()}/`,
    );
  }
}

/**
 * Lists the *.json record files in a directory, or null when the directory does
 * not exist (signalling that a legacy-file migration should be attempted).
 */
async function readJsonFileNames(dir: string): Promise<string[] | null> {
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((f) => f.endsWith('.json'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}
