import { BaseStore } from './base-store.js';
import { config } from '../config.js';
import { FileContent } from '../types/file-content.js';
import { isRecentFile } from '../utils.js';
import { pdfExtractionQueue } from '../services/pdf-extraction-queue.js';
import { atomicWriteFile, canonicalStringify, docsPath } from '../file-utils.js';
import { logger } from '../logger.js';
import path from 'path';
import fs from 'fs/promises';
import {
  indexRecordFileNames,
  mapInBatches,
  readJsonFileNames,
  recordBasename,
  removeOrphanJsonFiles,
} from './record-files.js';

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
interface PersistedFileContentMetadata {
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
class FileContentStore extends BaseStore<FileContent> {
  private persistedFileCount = 0;
  private changedFileIds: Set<string> = new Set();
  /**
   * Exact on-disk content of each record's metadata file, keyed by id. Lets
   * persist rewrite only the records whose canonical metadata actually changed.
   */
  private persistedMetadataById: Map<string, string> = new Map();
  /** Text files whose in-memory content changed and must be flushed. */
  private dirtyTextIds: Set<string> = new Set();

  /**
   * Optional base directory override, used only by tests so persistence never
   * touches the real docs/ tree. Production leaves this undefined and resolves
   * against the published docs directory.
   */
  constructor(private readonly baseDir?: string) {
    super();
  }

  readonly storageFileName = LEGACY_INDEX_NAME;

  private contentDirectory(): string {
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
    return recordBasename(id);
  }

  private metadataPath(id: string): string {
    return path.join(this.contentDirectory(), `${this.recordBasename(id)}.json`);
  }

  private textPath(id: string): string {
    return path.join(this.contentDirectory(), `${this.recordBasename(id)}.txt`);
  }

  private toIndexEntry(item: FileContent): PersistedFileContentMetadata {
    return {
      id: item.id,
      downloadUrl: item.downloadUrl,
      fileModified: item.fileModified,
      lastModifiedExtractedDate: item.lastModifiedExtractedDate,
      hasExtractedText: !!item.extractedText,
    };
  }

  drainChangedFileIds(): string[] {
    const ids = Array.from(this.changedFileIds);
    this.changedFileIds.clear();
    return ids;
  }

  override add(file: FileContent): void {
    const existing = this.getById(file.id);
    if (file.extractedText && existing?.extractedText !== file.extractedText) {
      this.dirtyTextIds.add(file.id);
    }
    super.add(file);
  }

  upsertFileMetadata(incomingFile: FileContent): void {
    const existing = this.getById(incomingFile.id);
    if (!existing) {
      this.add(incomingFile);
      return;
    }

    const fileModifiedChanged = existing.fileModified !== incomingFile.fileModified;
    const metadataChanged =
      existing.downloadUrl !== incomingFile.downloadUrl || fileModifiedChanged;

    if (!metadataChanged) return;

    existing.downloadUrl = incomingFile.downloadUrl;
    existing.fileModified = incomingFile.fileModified;

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

  protected onItemLoad(file: FileContent): void {
    this.scheduleExtractionIfNeeded(file);
  }

  protected onItemAdd(file: FileContent): void {
    this.scheduleExtractionIfNeeded(file);
  }

  private clearExtractedText(file: FileContent): void {
    const hadExtractedText = !!file.extractedText || !!file.lastModifiedExtractedDate;
    file.lastModifiedExtractedDate = undefined;
    file.extractedText = undefined;
    if (hadExtractedText) {
      this.changedFileIds.add(file.id);
    }
  }

  private applyExtractedText(file: FileContent, text: string, extractedForModified: string): void {
    const changed =
      file.extractedText !== text || file.lastModifiedExtractedDate !== extractedForModified;
    file.extractedText = text;
    file.lastModifiedExtractedDate = extractedForModified;
    if (changed) {
      this.changedFileIds.add(file.id);
      this.dirtyTextIds.add(file.id);
    }
  }

  private scheduleExtractionIfNeeded(file: FileContent): void {
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

  async saveToDisk(): Promise<void> {
    await pdfExtractionQueue.waitForCompletion();
    logger.info('Persisting file contents to disk');

    const dir = this.contentDirectory();
    await fs.mkdir(dir, { recursive: true });

    const fileContents = this.getAll();
    logger.info(
      `${fileContents.length - this.persistedFileCount} new items. Total: ${fileContents.length}`,
    );

    // Map every current record to its metadata filename, failing loudly on any
    // collision rather than silently overwriting one record with another.
    const currentJsonFiles = indexRecordFileNames(
      CONTENT_DIR_NAME,
      fileContents.map((item) => item.id),
    );

    // Write only the metadata records whose canonical serialization changed.
    const metadataWrites: Array<{ item: FileContent; canonical: string }> = [];
    for (const item of fileContents) {
      const canonical = canonicalStringify(this.toIndexEntry(item));
      if (this.persistedMetadataById.get(item.id) === canonical) continue;
      metadataWrites.push({ item, canonical });
    }
    await mapInBatches(metadataWrites, ({ item, canonical }) =>
      atomicWriteFile(this.metadataPath(item.id), canonical),
    );
    for (const { item, canonical } of metadataWrites) {
      this.persistedMetadataById.set(item.id, canonical);
    }
    const written = metadataWrites.length;

    // Extracted text can be large, so only flush files changed in this process.
    // Loaded text starts clean; new and successfully re-extracted text is dirty.
    const dirtyTextItems = fileContents.filter((item) => this.dirtyTextIds.has(item.id));
    await this.writeExtractedTextFiles(dirtyTextItems);

    // Remove orphan metadata files only after every write has succeeded, so an
    // interrupted write never triggers destructive deletion. Scoped to *.json so
    // the sibling .txt files are never touched.
    const removed = await removeOrphanJsonFiles(dir, currentJsonFiles, {
      storeName: CONTENT_DIR_NAME,
      priorRecordCount: this.persistedFileCount,
    });

    // One-time migration cutover: once per-record metadata exists, the legacy
    // monolithic index is obsolete. force:true makes this a no-op when absent.
    await fs.rm(this.legacyIndexPath(), { force: true });
    // Drop the now-obsolete bulk-load chunk directory (idempotent once gone).
    await fs.rm(this.obsoleteChunksDir(), { recursive: true, force: true });

    const withoutExtractedTextCount = fileContents.filter(
      (f) => !f.lastModifiedExtractedDate,
    ).length;
    logger.info(
      `file-contents/: ${written} metadata written, ${removed} removed, ` +
        `${withoutExtractedTextCount}/${fileContents.length} without extracted text`,
    );
    this.persistedFileCount = fileContents.length;
    this.dirtyTextIds.clear();
  }

  private async writeExtractedTextFiles(items: FileContent[]): Promise<void> {
    const itemsWithText = items.filter(
      (item): item is FileContent & { extractedText: string } => !!item.extractedText,
    );
    await mapInBatches(itemsWithText, (item) =>
      atomicWriteFile(this.textPath(item.id), item.extractedText),
    );
    logger.info(`Wrote ${itemsWithText.length} individual text files`);
  }

  async loadFromDisk(): Promise<void> {
    const dir = this.contentDirectory();
    const metadataFiles = await readJsonFileNames(dir);

    if (metadataFiles && metadataFiles.length > 0) {
      await this.loadFromPerRecordFiles(dir, metadataFiles);
      return;
    }

    await this.migrateFromLegacyIndex();
  }

  private async loadFromPerRecordFiles(dir: string, metadataFiles: string[]): Promise<void> {
    const fileContentsById = new Map<string, FileContent>();
    const idsWithText = new Set<string>();

    const loadedMetadata = await mapInBatches(metadataFiles, async (filename) => {
      const raw = await fs.readFile(path.join(dir, filename), 'utf8');
      const entry = JSON.parse(raw) as PersistedFileContentMetadata;
      return { entry, raw };
    });
    for (const { entry, raw } of loadedMetadata) {
      fileContentsById.set(entry.id, {
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

    await this.loadTextForItems(fileContentsById, idsWithText);

    for (const item of fileContentsById.values()) {
      this.onItemLoad(item);
    }

    this.itemsById = fileContentsById;
    this.persistedFileCount = fileContentsById.size;
    logger.info(`Loaded ${fileContentsById.size} file content records`);
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

    const legacyMetadata = JSON.parse(raw) as unknown;
    if (!Array.isArray(legacyMetadata)) return;

    const fileContentsById = new Map<string, FileContent>();
    const idsWithText = new Set<string>();
    for (const entry of legacyMetadata as PersistedFileContentMetadata[]) {
      fileContentsById.set(entry.id, {
        id: entry.id,
        downloadUrl: entry.downloadUrl,
        fileModified: entry.fileModified,
        lastModifiedExtractedDate: entry.lastModifiedExtractedDate,
        extractedText: undefined,
      });
      if (entry.hasExtractedText) idsWithText.add(entry.id);
    }

    await this.loadTextForItems(fileContentsById, idsWithText);

    for (const item of fileContentsById.values()) {
      this.onItemLoad(item);
    }

    this.itemsById = fileContentsById;
    this.persistedFileCount = fileContentsById.size;
    logger.info(
      `Migrating ${fileContentsById.size} records from legacy ${LEGACY_INDEX_NAME} to ${CONTENT_DIR_NAME}/`,
    );
  }

  private async loadTextForItems(
    fileContentsById: Map<string, FileContent>,
    idsWithText: Set<string>,
  ): Promise<void> {
    const loaded = await mapInBatches([...idsWithText], async (id) => {
      const item = fileContentsById.get(id);
      if (!item) return false;
      try {
        const text = await fs.readFile(this.textPath(id), 'utf8');
        if (text) {
          item.extractedText = text;
          return true;
        }
      } catch {
        // Individual text file missing; it will be re-extracted.
      }
      return false;
    });
    logger.info(`Loaded ${loaded.filter(Boolean).length} extracted-text files`);
  }

  clear(): void {
    super.clear();
    this.changedFileIds.clear();
    this.dirtyTextIds.clear();
    // Keep persistedMetadataById: --clear-cache only wipes in-memory records, and
    // the on-disk snapshot still describes what is physically on disk.
  }
}

export const fileContentStore = new FileContentStore();
export { FileContentStore };
