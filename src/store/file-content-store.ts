import { BaseStore } from './base-store.js';
import { config } from '../config.js';
import { FileContentType } from '../types/file-content-type.js';
import { isRecentFile } from '../utils.js';
import { pdfExtractionQueue } from '../services/pdf-extraction-queue.js';
import { atomicWriteFile, readJsonFromFile, writeJsonToFile } from '../file-utils.js';
import { logger } from '../logger.js';
import path from 'path';
import fs from 'fs/promises';

const DOCS_DIR = path.join(import.meta.dirname, '..', '..', 'docs');
const CONTENT_DIR = path.join(DOCS_DIR, 'file-contents');
// Obsolete: extracted text used to be duplicated into bulk-load chunk files.
// Individual per-record files (CONTENT_DIR) are now the single source of truth;
// this directory is removed on the next persist. See AGENTS.md.
const OBSOLETE_CHUNKS_DIR = path.join(DOCS_DIR, 'file-contents-chunks');

/** Index entry stored in file-contents.json (without extracted text) */
interface FileContentIndex {
  id: string;
  downloadUrl: string;
  fileModified: string;
  lastModifiedExtractedDate?: string;
  hasExtractedText: boolean;
}

class FileContentStore extends BaseStore<FileContentType> {
  private initialCount = 0;
  private changedFileIds: Set<string> = new Set();

  getFileName(): string {
    return 'file-contents.json';
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

  async persistItemsToFile(): Promise<void> {
    await pdfExtractionQueue.waitForCompletion();
    logger.info('Persisting file contents to disk');

    await fs.mkdir(CONTENT_DIR, { recursive: true });

    const allItems = this.getAllItems();
    logger.info(`${allItems.length - this.initialCount} new items. Total: ${allItems.length}`);

    // Write index file (metadata only)
    const indexItems: FileContentIndex[] = allItems.map((item) => ({
      id: item.id,
      downloadUrl: item.downloadUrl,
      fileModified: item.fileModified,
      lastModifiedExtractedDate: item.lastModifiedExtractedDate,
      hasExtractedText: !!item.extractedText,
    }));
    await writeJsonToFile(indexItems, this.getFileName());

    // Write individual per-record text files (the single source of truth).
    const itemsWithText = allItems.filter((item) => item.extractedText);
    await this.writeIndividualFiles(itemsWithText);

    // One-time cleanup: drop the now-obsolete bulk-load chunk directory. Runs
    // after the individual files are written, so text is never removed before
    // its per-record copy exists. No-op once the directory is gone.
    await fs.rm(OBSOLETE_CHUNKS_DIR, { recursive: true, force: true });

    const withoutText = allItems.filter((f) => !f.lastModifiedExtractedDate).length;
    logger.info(`${withoutText}/${allItems.length} files without extracted text`);
  }

  private async writeIndividualFiles(items: FileContentType[]): Promise<void> {
    let count = 0;
    for (const item of items) {
      if (item.extractedText) {
        const filePath = path.join(CONTENT_DIR, `${extractFileId(item.id)}.txt`);
        await atomicWriteFile(filePath, item.extractedText);
        count++;
      }
    }
    logger.info(`Wrote ${count} individual text files`);
  }

  async loadItemsFromFile(): Promise<void> {
    const indexData = await readJsonFromFile<FileContentIndex[]>(this.getFileName());

    if (!indexData) {
      logger.info('No file contents index found. Starting fresh.');
      return;
    }

    // Create items from index
    const itemMap = new Map<string, FileContentType>();
    for (const entry of indexData) {
      itemMap.set(entry.id, {
        id: entry.id,
        downloadUrl: entry.downloadUrl,
        fileModified: entry.fileModified,
        lastModifiedExtractedDate: entry.lastModifiedExtractedDate,
        extractedText: undefined,
      });
    }

    // Load extracted text from the individual per-record files.
    await this.loadFromIndividualFiles(indexData, itemMap);

    // Trigger extraction for items that need it
    for (const item of itemMap.values()) {
      this.onItemLoad(item);
    }

    this.itemStore = itemMap;
    this.initialCount = itemMap.size;
    logger.info(`Loaded ${itemMap.size} file content entries`);
  }

  private async loadFromIndividualFiles(
    indexData: FileContentIndex[],
    itemMap: Map<string, FileContentType>,
  ): Promise<void> {
    try {
      await fs.access(CONTENT_DIR);
      let loaded = 0;

      for (const entry of indexData) {
        if (entry.hasExtractedText) {
          try {
            const filePath = path.join(CONTENT_DIR, `${extractFileId(entry.id)}.txt`);
            const text = await fs.readFile(filePath, 'utf8');
            const item = itemMap.get(entry.id);
            if (item && text) {
              item.extractedText = text;
              loaded++;
            }
          } catch {
            // Individual file missing, will be re-extracted
          }
        }
      }

      logger.info(`Loaded ${loaded} individual files`);
    } catch {
      logger.info('No content directory found');
    }
  }

  clearAllItems(): void {
    super.clearAllItems();
    this.changedFileIds.clear();
  }
}

/** Extracts the file ID from a URL (last path segment) */
function extractFileId(url: string): string {
  return url.split('/').pop() || url;
}

export const fileContentStore = new FileContentStore();
