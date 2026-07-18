import { BaseStore } from './base-store.js';
import { config } from '../config.js';
import { FileContentType } from '../types/file-content-type.js';
import { isRecentFile } from '../utils.js';
import { pdfExtractionQueue } from '../services/pdf-extraction-queue.js';
import {
  atomicWriteFile,
  canonicalStringify,
  docsPath,
  extractRecordId,
  sanitizeRecordId,
} from '../file-utils.js';
import { logger } from '../logger.js';
import path from 'path';
import fs from 'fs/promises';

/** Directory holding the per-record metadata (.json) and extracted text (.txt). */
const CONTENT_DIR_NAME = 'file-contents';
/** Legacy monolithic index, migrated to per-record files then deleted. */
const LEGACY_INDEX_NAME = 'file-contents.json';
// Obsolete: extracted text used to be duplicated into bulk-load chunk files.
// Per-record files (CONTENT_DIR) are now the single source of truth; this
// directory is removed on the next persist. See AGENTS.md.
const OBSOLETE_CHUNKS_NAME = 'file-contents-chunks';

/**
 * Metadata record persisted per file as `docs/file-contents/<fileId>.json`,
 * co-located next to its extracted-text `docs/file-contents/<fileId>.txt`. It
 * deliberately excludes the (potentially large) extracted text, which lives
 * only in the .txt file. `<fileId>` is `sanitizeRecordId(extractRecordId(id))`,
 * matching the .txt naming so a metadata record and its text share a basename.
 */
interface FileContentIndex {
  id: string;
  downloadUrl: string;
  fileModified: string;
  lastModifiedExtractedDate?: string;
  hasExtractedText: boolean;
}

/**
 * Stores file metadata as one canonical JSON object per record so git only
 * re-blobs the handful of records that changed each run, instead of rewriting a
 * ~56 MB monolithic index. Extracted PDF text stays in the sibling .txt files.
 *
 * Unlike papers/meetings this store cannot extend {@link PerRecordStore}: it
 * carries extra extraction concerns (the `changedFileIds` re-resolution signal
 * and in-place mutation as extractions complete), so it mirrors that store's
 * canonical-serialization, dirty-tracking and orphan-sweep pattern here.
 */
class FileContentStore extends BaseStore<FileContentType> {
  private initialCount = 0;
  private changedFileIds: Set<string> = new Set();
  /**
   * Exact on-disk content of each record's metadata file, keyed by id. Lets
   * persist rewrite only the records whose canonical metadata actually changed.
   */
  private persistedMetadataById: Map<string, string> = new Map();

  /**
   * Optional base directory override, used only by tests so persistence never
   * touches the real docs/ tree. Production leaves this undefined and resolves
   * against the published docs directory.
   */
  constructor(private readonly baseDir?: string) {
    super();
  }

  getFileName(): string {
    return LEGACY_INDEX_NAME;
  }

  private contentDir(): string {
    return this.baseDir ? path.join(this.baseDir, CONTENT_DIR_NAME) : docsPath(CONTENT_DIR_NAME);
  }

  private legacyIndexPath(): string {
    return this.baseDir ? path.join(this.baseDir, LEGACY_INDEX_NAME) : docsPath(LEGACY_INDEX_NAME);
  }

  private obsoleteChunksDir(): string {
    return this.baseDir
      ? path.join(this.baseDir, OBSOLETE_CHUNKS_NAME)
      : docsPath(OBSOLETE_CHUNKS_NAME);
  }

  private recordBasename(id: string): string {
    return sanitizeRecordId(extractRecordId(id));
  }

  private metadataPath(id: string): string {
    return path.join(this.contentDir(), `${this.recordBasename(id)}.json`);
  }

  private textPath(id: string): string {
    return path.join(this.contentDir(), `${this.recordBasename(id)}.txt`);
  }

  private toIndexEntry(item: FileContentType): FileContentIndex {
    return {
      id: item.id,
      downloadUrl: item.downloadUrl,
      fileModified: item.fileModified,
      lastModifiedExtractedDate: item.lastModifiedExtractedDate,
      hasExtractedText: !!item.extractedText,
    };
  }

  consumeChangedFileIds(): string[] {
    const ids = Array.from(this.changedFileIds);
    this.changedFileIds.clear();
    return ids;
  }

  upsertFromPaperFile(nextFile: FileContentType): void {
    const existing = this.getById(nextFile.id);
    if (!existing) {
      this.add(nextFile);
      return;
    }

    const fileModifiedChanged = existing.fileModified !== nextFile.fileModified;
    const metadataChanged = existing.downloadUrl !== nextFile.downloadUrl || fileModifiedChanged;

    if (!metadataChanged) return;

    existing.downloadUrl = nextFile.downloadUrl;
    existing.fileModified = nextFile.fileModified;

    if (fileModifiedChanged) {
      // Keep the last successful extraction until the new version can actually
      // be read. A 401/403 may mean access was withdrawn, not that the old text
      // ceased to be useful. The differing extraction date marks it as stale.
      this.changedFileIds.add(existing.id);
    }

    if (!config.extractPdfText) {
      return;
    }

    this.scheduleExtractionIfNeeded(existing);
  }

  protected onItemLoad(file: FileContentType): void {
    this.scheduleExtractionIfNeeded(file);
  }

  protected onItemAdd(file: FileContentType): void {
    this.scheduleExtractionIfNeeded(file);
  }

  private clearExtractedText(file: FileContentType): void {
    const hadExtractedText = !!file.extractedText || !!file.lastModifiedExtractedDate;
    file.lastModifiedExtractedDate = undefined;
    file.extractedText = undefined;
    if (hadExtractedText) {
      this.changedFileIds.add(file.id);
    }
  }

  private applyExtractedText(
    file: FileContentType,
    text: string,
    extractedForModified: string,
  ): void {
    const changed =
      file.extractedText !== text || file.lastModifiedExtractedDate !== extractedForModified;
    file.extractedText = text;
    file.lastModifiedExtractedDate = extractedForModified;
    if (changed) {
      this.changedFileIds.add(file.id);
    }
  }

  private scheduleExtractionIfNeeded(file: FileContentType): void {
    if (!isRecentFile(file.fileModified)) {
      this.clearExtractedText(file);
      return;
    }

    const needsExtraction =
      config.extractPdfText &&
      (file.fileModified !== file.lastModifiedExtractedDate ||
        (file.lastModifiedExtractedDate && !file.extractedText));

    if (needsExtraction) {
      const fileModifiedAtSchedule = file.fileModified;
      pdfExtractionQueue.add(file.downloadUrl, (text) => {
        if (file.fileModified !== fileModifiedAtSchedule) {
          return;
        }
        this.applyExtractedText(file, text, fileModifiedAtSchedule);
      });
    }
  }

  override removeById(id: string): boolean {
    const removed = super.removeById(id);
    if (removed) {
      // No record left to write; its metadata file is unlinked by the orphan
      // sweep on the next persist (a removed record is, by definition, orphaned).
      this.persistedMetadataById.delete(id);
    }
    return removed;
  }

  async persistItemsToFile(): Promise<void> {
    await pdfExtractionQueue.waitForCompletion();
    logger.info('Persisting file contents to disk');

    const dir = this.contentDir();
    await fs.mkdir(dir, { recursive: true });

    const allItems = this.getAllItems();
    logger.info(`${allItems.length - this.initialCount} new items. Total: ${allItems.length}`);

    // Map every current record to its metadata filename, failing loudly on any
    // collision rather than silently overwriting one record with another.
    const currentJsonFiles = new Map<string, string>();
    for (const item of allItems) {
      const filename = `${this.recordBasename(item.id)}.json`;
      const clashingId = currentJsonFiles.get(filename);
      if (clashingId !== undefined) {
        throw new Error(
          `file-contents: filename collision on ${filename} (ids ${clashingId} and ${item.id}); ` +
            'two records sanitize to the same file',
        );
      }
      currentJsonFiles.set(filename, item.id);
    }

    // Write only the metadata records whose canonical serialization changed.
    let written = 0;
    for (const item of allItems) {
      const canonical = canonicalStringify(this.toIndexEntry(item));
      if (this.persistedMetadataById.get(item.id) === canonical) continue;
      await atomicWriteFile(this.metadataPath(item.id), canonical);
      this.persistedMetadataById.set(item.id, canonical);
      written++;
    }

    // Write the extracted-text .txt files (the single source of truth for text).
    // atomicWriteFile always rewrites, but byte-identical content dedupes to the
    // same git blob so unchanged text adds no history. (Skipping the rewrite
    // outright would need a read-back compare per file — not worth the I/O.)
    const itemsWithText = allItems.filter((item) => item.extractedText);
    await this.writeIndividualFiles(itemsWithText);

    // Remove orphan metadata files only after every write has succeeded, so an
    // interrupted write never triggers destructive deletion. Scoped to *.json so
    // the sibling .txt files are never touched.
    const stored = await fs.readdir(dir);
    const orphans = stored.filter((f) => f.endsWith('.json') && !currentJsonFiles.has(f));
    await Promise.all(orphans.map((f) => fs.unlink(path.join(dir, f))));

    // One-time migration cutover: once per-record metadata exists, the legacy
    // monolithic index is obsolete. force:true makes this a no-op when absent.
    await fs.rm(this.legacyIndexPath(), { force: true });
    // Drop the now-obsolete bulk-load chunk directory (idempotent once gone).
    await fs.rm(this.obsoleteChunksDir(), { recursive: true, force: true });

    const withoutText = allItems.filter((f) => !f.lastModifiedExtractedDate).length;
    logger.info(
      `file-contents/: ${written} metadata written, ${orphans.length} removed, ` +
        `${withoutText}/${allItems.length} without extracted text`,
    );
    this.initialCount = allItems.length;
  }

  private async writeIndividualFiles(items: FileContentType[]): Promise<void> {
    let count = 0;
    for (const item of items) {
      if (item.extractedText) {
        await atomicWriteFile(this.textPath(item.id), item.extractedText);
        count++;
      }
    }
    logger.info(`Wrote ${count} individual text files`);
  }

  async loadItemsFromFile(): Promise<void> {
    const dir = this.contentDir();
    const metadataFiles = await readMetadataFileNames(dir);

    if (metadataFiles && metadataFiles.length > 0) {
      await this.loadFromPerRecordFiles(dir, metadataFiles);
      return;
    }

    await this.migrateFromLegacyIndex();
  }

  private async loadFromPerRecordFiles(dir: string, metadataFiles: string[]): Promise<void> {
    const itemMap = new Map<string, FileContentType>();
    const idsWithText = new Set<string>();

    for (const filename of metadataFiles) {
      const raw = await fs.readFile(path.join(dir, filename), 'utf8');
      const entry = JSON.parse(raw) as FileContentIndex;
      itemMap.set(entry.id, {
        id: entry.id,
        downloadUrl: entry.downloadUrl,
        fileModified: entry.fileModified,
        lastModifiedExtractedDate: entry.lastModifiedExtractedDate,
        extractedText: undefined,
      });
      // Snapshot the exact on-disk bytes so an unchanged record is not rewritten.
      this.persistedMetadataById.set(entry.id, raw);
      if (entry.hasExtractedText) idsWithText.add(entry.id);
    }

    await this.loadTextForItems(itemMap, idsWithText);

    for (const item of itemMap.values()) {
      this.onItemLoad(item);
    }

    this.itemStore = itemMap;
    this.initialCount = itemMap.size;
    logger.info(`Loaded ${itemMap.size} file content records`);
  }

  /**
   * Loads the legacy `docs/file-contents.json` array when no per-record metadata
   * files exist yet, leaving `persistedMetadataById` empty so the next persist
   * writes every per-record file and deletes the legacy index. One-time cutover.
   */
  private async migrateFromLegacyIndex(): Promise<void> {
    let raw: string;
    try {
      raw = await fs.readFile(this.legacyIndexPath(), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info('No file contents found. Starting fresh.');
        return;
      }
      throw error;
    }

    const indexData = JSON.parse(raw) as unknown;
    if (!Array.isArray(indexData)) return;

    const itemMap = new Map<string, FileContentType>();
    const idsWithText = new Set<string>();
    for (const entry of indexData as FileContentIndex[]) {
      itemMap.set(entry.id, {
        id: entry.id,
        downloadUrl: entry.downloadUrl,
        fileModified: entry.fileModified,
        lastModifiedExtractedDate: entry.lastModifiedExtractedDate,
        extractedText: undefined,
      });
      if (entry.hasExtractedText) idsWithText.add(entry.id);
    }

    await this.loadTextForItems(itemMap, idsWithText);

    for (const item of itemMap.values()) {
      this.onItemLoad(item);
    }

    this.itemStore = itemMap;
    this.initialCount = itemMap.size;
    logger.info(
      `Migrating ${itemMap.size} records from legacy ${LEGACY_INDEX_NAME} to ${CONTENT_DIR_NAME}/`,
    );
  }

  private async loadTextForItems(
    itemMap: Map<string, FileContentType>,
    idsWithText: Set<string>,
  ): Promise<void> {
    let loaded = 0;
    for (const id of idsWithText) {
      const item = itemMap.get(id);
      if (!item) continue;
      try {
        const text = await fs.readFile(this.textPath(id), 'utf8');
        if (text) {
          item.extractedText = text;
          loaded++;
        }
      } catch {
        // Individual text file missing; it will be re-extracted.
      }
    }
    logger.info(`Loaded ${loaded} extracted-text files`);
  }

  clearAllItems(): void {
    super.clearAllItems();
    this.changedFileIds.clear();
    // Keep persistedMetadataById: --clear-cache only wipes in-memory records, and
    // the on-disk snapshot still describes what is physically on disk.
  }
}

/**
 * Lists the *.json metadata files in the content directory, or null when the
 * directory does not exist (signalling a legacy-index migration should run).
 */
async function readMetadataFileNames(dir: string): Promise<string[] | null> {
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

export const fileContentStore = new FileContentStore();
export { FileContentStore };
