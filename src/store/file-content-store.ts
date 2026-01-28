import { BaseStore } from './base-store';
import { config } from '../config';
import { FileContentType } from '../types/file-content-type';
import { isRecentFile } from '../services/date-service';
import { pdfExtractionQueue } from '../services/pdf-extraction-queue';
import { readJsonFromFile, writeJsonToFile } from '../file-utils';
import path from 'path';
import fs from 'fs/promises';

const CHUNK_SIZE = 1000;
const DOCS_DIR = path.join(__dirname, '..', '..', 'docs');
const CONTENT_DIR = path.join(DOCS_DIR, 'file-contents');
const CHUNKS_DIR = path.join(DOCS_DIR, 'file-contents-chunks');

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

  getFileName(): string {
    return 'file-contents.json';
  }

  protected async onItemLoad(file: FileContentType): Promise<void> {
    this.scheduleExtractionIfNeeded(file);
  }

  protected async onItemAdd(file: FileContentType): Promise<void> {
    this.scheduleExtractionIfNeeded(file);
  }

  private scheduleExtractionIfNeeded(file: FileContentType): void {
    if (!isRecentFile(file.fileModified)) {
      file.lastModifiedExtractedDate = undefined;
      file.extractedText = undefined;
      return;
    }

    const needsExtraction =
      config.extractPdfText &&
      (file.fileModified !== file.lastModifiedExtractedDate ||
        (file.lastModifiedExtractedDate && !file.extractedText));

    if (needsExtraction) {
      pdfExtractionQueue.add(file.downloadUrl, (text) => {
        file.extractedText = text;
        file.lastModifiedExtractedDate = file.fileModified;
      });
    }
  }

  async persistItemsToFile(): Promise<void> {
    await pdfExtractionQueue.waitForCompletion();
    console.log('Persisting file contents to disk');

    await fs.mkdir(CONTENT_DIR, { recursive: true });
    await fs.mkdir(CHUNKS_DIR, { recursive: true });

    const allItems = this.getAllItems();
    console.log(`${allItems.length - this.initialCount} new items. Total: ${allItems.length}`);

    // Write index file (metadata only)
    const indexItems: FileContentIndex[] = allItems.map((item) => ({
      id: item.id,
      downloadUrl: item.downloadUrl,
      fileModified: item.fileModified,
      lastModifiedExtractedDate: item.lastModifiedExtractedDate,
      hasExtractedText: !!item.extractedText,
    }));
    await writeJsonToFile(indexItems, this.getFileName());

    // Write individual text files and chunks
    const itemsWithText = allItems.filter((item) => item.extractedText);
    await this.writeIndividualFiles(itemsWithText);
    await this.writeChunkFiles(itemsWithText);

    const withoutText = allItems.filter((f) => !f.lastModifiedExtractedDate).length;
    console.log(`${withoutText}/${allItems.length} files without extracted text`);
  }

  private async writeIndividualFiles(items: FileContentType[]): Promise<void> {
    let count = 0;
    for (const item of items) {
      if (item.extractedText) {
        const filePath = path.join(CONTENT_DIR, `${extractFileId(item.id)}.txt`);
        await fs.writeFile(filePath, item.extractedText, 'utf8');
        count++;
      }
    }
    console.log(`Wrote ${count} individual text files`);
  }

  private async writeChunkFiles(items: FileContentType[]): Promise<void> {
    const chunks: FileContentType[][] = [];
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      chunks.push(items.slice(i, i + CHUNK_SIZE));
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunkData = chunks[i].map((item) => ({
        id: item.id,
        fileId: extractFileId(item.id),
        extractedText: item.extractedText,
      }));
      await fs.writeFile(path.join(CHUNKS_DIR, `chunk-${i}.json`), JSON.stringify(chunkData));
    }
    console.log(`Wrote ${chunks.length} chunk files`);
  }

  async loadItemsFromFile(): Promise<void> {
    const indexData = await readJsonFromFile<FileContentIndex[]>(this.getFileName());

    if (!indexData) {
      console.log('No file contents index found. Starting fresh.');
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

    // Load extracted text from chunks (preferred) or individual files
    const loadedFromChunks = await this.loadFromChunks(itemMap);
    if (!loadedFromChunks) {
      await this.loadFromIndividualFiles(indexData, itemMap);
    }

    // Trigger extraction for items that need it
    for (const item of itemMap.values()) {
      this.onItemLoad(item);
    }

    this.itemStore = itemMap;
    this.initialCount = itemMap.size;
    console.log(`Loaded ${itemMap.size} file content entries`);
  }

  private async loadFromChunks(itemMap: Map<string, FileContentType>): Promise<boolean> {
    try {
      const files = await fs.readdir(CHUNKS_DIR);
      const chunkFiles = files
        .filter((f) => f.startsWith('chunk-') && f.endsWith('.json'))
        .sort((a, b) => extractChunkIndex(a) - extractChunkIndex(b));

      if (chunkFiles.length === 0) return false;

      console.log(`Loading from ${chunkFiles.length} chunk files`);
      let loaded = 0;

      for (const file of chunkFiles) {
        const data = JSON.parse(await fs.readFile(path.join(CHUNKS_DIR, file), 'utf8'));
        for (const chunk of data) {
          const item = itemMap.get(chunk.id);
          if (item && chunk.extractedText) {
            item.extractedText = chunk.extractedText;
            loaded++;
          }
        }
      }

      console.log(`Loaded ${loaded} items from chunks`);
      return loaded > 0;
    } catch {
      return false;
    }
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

      console.log(`Loaded ${loaded} individual files`);
    } catch {
      console.log('No content directory found');
    }
  }
}

/** Extracts the file ID from a URL (last path segment) */
function extractFileId(url: string): string {
  return url.split('/').pop() || url;
}

/** Extracts the chunk index from a filename like "chunk-0.json" */
function extractChunkIndex(filename: string): number {
  return parseInt(filename.replace('chunk-', '').replace('.json', ''));
}

export const fileContentStore = new FileContentStore();
