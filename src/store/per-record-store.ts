import fs from 'fs/promises';
import path from 'path';
import { BaseStore } from './base-store.js';
import { atomicWriteFile, canonicalStringify, docsPath } from '../file-utils.js';
import { logger } from '../logger.js';
import {
  indexRecordFileNames,
  mapInBatches,
  readJsonFileNames,
  recordFileName,
  removeOrphanJsonFiles,
} from './record-files.js';

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
  private persistedRecordCount = 0;

  /** Sub-directory under docs/ that holds the per-record files (e.g. "papers"). */
  abstract readonly recordDirectoryName: string;

  /**
   * Optional base directory override, used only by tests so persistence never
   * touches the real docs/ tree. Production stores leave this undefined and
   * resolve against the published docs directory.
   */
  constructor(private readonly baseDir?: string) {
    super();
  }

  private recordsDirectory(): string {
    return this.baseDir
      ? path.join(this.baseDir, this.recordDirectoryName)
      : docsPath(this.recordDirectoryName);
  }

  private legacyFilePath(): string {
    return this.baseDir
      ? path.join(this.baseDir, this.storageFileName)
      : docsPath(this.storageFileName);
  }

  private recordFileName(item: T): string {
    return recordFileName(item.id);
  }

  override add(item: T): void {
    if ((item as T & { deleted?: boolean }).deleted) {
      // Tombstone: BaseStore.add routes this to removeById.
      super.add(item);
      return;
    }
    const existing = this.itemsById.get(item.id);
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

  override clear(): void {
    super.clear();
    this.dirtyIds.clear();
  }

  override async saveToDisk(): Promise<void> {
    const dir = this.recordsDirectory();
    await fs.mkdir(dir, { recursive: true });

    const items = this.getAll();

    // Map every current record to its filename, failing loudly on any collision
    // rather than silently overwriting one record with another.
    const currentFiles = indexRecordFileNames(
      this.recordDirectoryName,
      items.map((item) => item.id),
    );

    // Write only the records that changed this run.
    const dirtyItems = items.filter((item) => this.dirtyIds.has(item.id));
    await mapInBatches(dirtyItems, (item) =>
      atomicWriteFile(path.join(dir, this.recordFileName(item)), canonicalStringify(item)),
    );
    const written = dirtyItems.length;

    // Remove orphans only after every write has succeeded, so an interrupted
    // write never triggers destructive deletion. Under normal add-only runs
    // this is a no-op; it only removes files after tombstones or a
    // --clear-cache full rebuild.
    const removed = await removeOrphanJsonFiles(dir, currentFiles, {
      storeName: this.recordDirectoryName,
      priorRecordCount: this.persistedRecordCount,
    });

    // One-time migration cutover: once per-record files exist, the legacy
    // monolithic file is obsolete. force:true makes this a no-op when absent.
    await fs.rm(this.legacyFilePath(), { force: true });

    const total = items.length;
    const added = total - this.persistedRecordCount;
    logger.info(
      `${this.recordDirectoryName}/: ${written} written, ${removed} removed, ` +
        `${added} added (${this.persistedRecordCount} -> ${total})`,
    );

    this.dirtyIds.clear();
    this.persistedRecordCount = total;
  }

  override async loadFromDisk(): Promise<void> {
    const dir = this.recordsDirectory();
    const files = await readJsonFileNames(dir);

    // Only treat the per-record directory as authoritative when it actually holds
    // records. An existing-but-empty directory (readJsonFileNames returns []) must
    // still fall through to legacy migration; otherwise we would load zero records
    // and the next persist would delete the legacy file, wiping the archive. This
    // mirrors FileContentStore.loadFromDisk.
    if (files !== null && files.length > 0) {
      const records = await mapInBatches(files, async (filename) => {
        const raw = await fs.readFile(path.join(dir, filename), 'utf8');
        return JSON.parse(raw) as T;
      });
      for (const item of records) {
        this.itemsById.set(item.id, item);
        this.onItemLoad(item);
      }
      this.persistedRecordCount = this.itemsById.size;
      logger.info(`Loaded ${this.itemsById.size} records from ${this.recordDirectoryName}/`);
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
      this.itemsById.set(item.id, item);
      this.onItemLoad(item);
      this.dirtyIds.add(item.id);
    }
    this.persistedRecordCount = this.itemsById.size;
    logger.info(
      `Migrating ${this.itemsById.size} records from legacy ${this.storageFileName} ` +
        `to ${this.recordDirectoryName}/`,
    );
  }
}
