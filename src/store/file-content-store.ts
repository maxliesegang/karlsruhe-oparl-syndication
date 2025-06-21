import { BaseStore } from './base-store';
import { config } from '../config';
import { FileContentType } from '../types/file-content-type';
import { pdfService } from '../services/pdf-service';
import { dateService } from '../services/date-service';
import { readJsonFromFile, writeJsonToFile } from '../file-utils';
import path from 'path';
import fs from 'fs/promises';

const MAX_CONCURRENT_EXTRACTIONS = 10; // Maximum number of concurrent extractions
const MAX_EXTRACTION_QUEUE_SIZE = 10000; // Maximum number of concurrent extractions
const DELAY_BETWEEN_EXTRACTIONS = 1000; // Delay in milliseconds between extractions

class FileContentStore extends BaseStore<FileContentType> {
  private pendingExtractions: Set<Promise<void>> = new Set();
  private initialSizeWithoutText = 0;
  private extractionQueue: { file: FileContentType; url: string }[] = [];
  private isProcessingQueue = false;

  getFileName(): string {
    return 'file-contents.json';
  }

  private getFileContentDirectoryPath(): string {
    return path.join(__dirname, '..', '..', 'docs', 'file-contents');
  }

  private getFileIdFromUrl(id: string): string {
    // Extract the last part of the ID URL (e.g., "664428" from "https://web1.karlsruhe.de/oparl/bodies/0001/files/664428")
    const parts = id.split('/');
    return parts[parts.length - 1];
  }

  private getFilePathForId(id: string): string {
    const fileId = this.getFileIdFromUrl(id);
    return path.join(this.getFileContentDirectoryPath(), `${fileId}.txt`);
  }

  protected async onItemLoad(file: FileContentType): Promise<void> {
    await this.handleFileExtraction(file);
  }

  protected async onItemAdd(file: FileContentType): Promise<void> {
    await this.handleFileExtraction(file);
  }

  private async handleFileExtraction(file: FileContentType): Promise<void> {
    const isCurrentFile = dateService.isCurrentFile(file.fileModified);
    if (!isCurrentFile) {
      file.lastModifiedExtractedDate = undefined;
      file.extractedText = undefined;
      return;
    }

    // Extract text if:
    // 1. The file has changed since the last extraction (file.fileModified !== file.lastModifiedExtractedDate)
    // 2. OR the last extraction failed (file.lastModifiedExtractedDate exists but file.extractedText is undefined)
    if (
      config.extractPdfText &&
      (file.fileModified !== file.lastModifiedExtractedDate ||
        (file.lastModifiedExtractedDate && !file.extractedText))
    ) {
      await this.extractAndSavePdfText(file, file.downloadUrl);
    }
  }

  private async extractAndSavePdfText(file: FileContentType, url: string): Promise<void> {
    // Add to queue instead of processing immediately
    if (this.extractionQueue.length < MAX_EXTRACTION_QUEUE_SIZE) {
      this.extractionQueue.push({ file, url });
    }

    console.log(`Added PDF extraction to queue. Queue size: ${this.extractionQueue.length}`);

    // Start processing the queue if it's not already being processed
    if (!this.isProcessingQueue) {
      console.log('Starting queue processing');
      this.processExtractionQueue();
    }
  }

  private async processExtractionQueue(): Promise<void> {
    if (this.extractionQueue.length === 0) {
      this.isProcessingQueue = false;
      console.log('Queue processing completed');
      return;
    }

    this.isProcessingQueue = true;

    // Process up to MAX_CONCURRENT_EXTRACTIONS items at once
    const currentBatch = this.extractionQueue.splice(0, MAX_CONCURRENT_EXTRACTIONS);
    console.log(
      `Processing batch of ${currentBatch.length} items. Remaining in queue: ${this.extractionQueue.length}`,
    );

    const batchPromises = currentBatch.map(async ({ file, url }) => {
      const extractionPromise = (async () => {
        console.log(`Extracting text from PDF: ${url}`);
        const extractedText = await pdfService.extractTextFromPdf(url);

        if (extractedText) {
          file.extractedText = extractedText;
          file.lastModifiedExtractedDate = file.fileModified;
          console.log(`Successfully extracted text from PDF: ${url}`);
        } else {
          console.log(`Failed to extract text from PDF: ${url}`);
        }
      })();

      this.pendingExtractions.add(extractionPromise);

      try {
        await extractionPromise;
      } finally {
        this.pendingExtractions.delete(extractionPromise);
      }
    });

    await Promise.all(batchPromises);
    console.log(
      `Batch processing completed. Adding delay of ${DELAY_BETWEEN_EXTRACTIONS}ms before next batch`,
    );

    // Add a delay before processing the next batch
    await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_EXTRACTIONS));

    // Continue processing the queue
    await this.processExtractionQueue();
  }

  async persistItemsToFile(): Promise<void> {
    // Wait for the queue to be fully processed
    if (this.isProcessingQueue || this.extractionQueue.length > 0) {
      console.log(
        `Waiting for extraction queue to complete. Queue size: ${this.extractionQueue.length}, Processing: ${this.isProcessingQueue}`,
      );

      while (this.isProcessingQueue || this.extractionQueue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      console.log('Extraction queue has been fully processed');
    }

    // Wait for any remaining pending extractions
    if (this.pendingExtractions.size > 0) {
      console.log(`Waiting for ${this.pendingExtractions.size} pending extractions to complete`);
      await Promise.all(this.pendingExtractions);
      console.log('All pending extractions completed');
    }

    console.log('Persisting items to file');

    // Create file content directory if it doesn't exist
    const contentDirPath = this.getFileContentDirectoryPath();
    await fs.mkdir(contentDirPath, { recursive: true });

    // Get all items
    const allItems = Array.from(this.itemStore.values());
    const newSize = allItems.length;
    const added = newSize - this.initialSizeWithoutText;
    console.log(
      `${added} added to ${this.getFileName()}  \t Initial size:${this.initialSizeWithoutText} \t New size: ${newSize}`,
    );

    // Create a small index file with metadata only (no extracted text)
    const indexItems = allItems.map((item) => ({
      id: item.id,
      downloadUrl: item.downloadUrl,
      fileModified: item.fileModified,
      lastModifiedExtractedDate: item.lastModifiedExtractedDate,
      hasExtractedText: !!item.extractedText,
    }));

    // Write the index file
    await writeJsonToFile(indexItems, this.getFileName());

    // Write each item's extracted text to its own plain text file
    let filesWritten = 0;
    for (const item of allItems) {
      // Only write files that have extracted text
      if (item.extractedText) {
        const filePath = this.getFilePathForId(item.id);
        await fs.writeFile(filePath, item.extractedText, 'utf8');
        filesWritten++;
      }
    }
    console.log(`Wrote ${filesWritten} individual files to ${contentDirPath}`);

    const filesWithoutText = allItems.filter((file) => !file.lastModifiedExtractedDate);
    console.log(`Initial ${this.initialSizeWithoutText} files without text`);
    console.log(`${filesWithoutText.length}/${this.itemStore.size} files without text`);
  }

  async loadItemsFromFile(): Promise<void> {
    // First, try to load the index file
    const indexData = await readJsonFromFile(this.getFileName());

    if (!indexData || !Array.isArray(indexData)) {
      console.log('No index file found or invalid format. Starting with empty store.');
      this.initialSizeWithoutText = 0;
      return;
    }

    // Create a map to store the items
    const itemMap = new Map<string, FileContentType>();

    // Try to load individual files from the file content directory
    const contentDirPath = this.getFileContentDirectoryPath();

    try {
      // Check if file content directory exists
      await fs.access(contentDirPath);

      // Create placeholder items from the index file
      for (const indexItem of indexData) {
        const item: FileContentType = {
          id: indexItem.id,
          downloadUrl: indexItem.downloadUrl,
          fileModified: indexItem.fileModified,
          lastModifiedExtractedDate: indexItem.lastModifiedExtractedDate,
          extractedText: undefined,
        };

        itemMap.set(item.id, item);
      }

      // Load content for items that have extracted text
      let filesLoaded = 0;
      for (const indexItem of indexData) {
        if (indexItem.hasExtractedText) {
          try {
            const filePath = this.getFilePathForId(indexItem.id);
            const extractedText = await fs.readFile(filePath, 'utf8');

            if (extractedText) {
              const item = itemMap.get(indexItem.id);
              if (item) {
                item.extractedText = extractedText;
                filesLoaded++;
              }
            }
          } catch (error) {
            console.error(`Error loading file for ID ${indexItem.id}:`, error);
          }
        }
      }

      console.log(`Loaded ${filesLoaded} individual content files`);

      // Call onItemLoad for each item
      for (const item of itemMap.values()) {
        this.onItemLoad(item);
      }
    } catch (error) {
      console.log('No file content directory found or error accessing it. Using index file only.');

      // If file content directory doesn't exist, use the index file to create placeholder items
      for (const indexItem of indexData) {
        const item: FileContentType = {
          id: indexItem.id,
          downloadUrl: indexItem.downloadUrl,
          fileModified: indexItem.fileModified,
          lastModifiedExtractedDate: indexItem.lastModifiedExtractedDate,
          extractedText: undefined,
        };

        itemMap.set(item.id, item);
        this.onItemLoad(item);
      }
    }

    // Set the item store
    this.itemStore = itemMap;

    // Calculate initial size without text
    this.initialSizeWithoutText = Array.from(this.itemStore.values()).filter(
      (file) => !file.lastModifiedExtractedDate,
    ).length;

    console.log(`Loaded ${this.itemStore.size} items from disk`);
  }
}

export const fileContentStore = new FileContentStore();
