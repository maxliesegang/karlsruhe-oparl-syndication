import { BaseStore } from './base-store';
import { config } from '../config';
import { FileContentType } from '../types/file-content-type';
import { pdfService } from '../services/pdf-service';
import { dateService } from '../services/date-service';
import { readJsonFromFile, writeJsonToFile } from '../file-utils';
import path from 'path';

const MAX_CONCURRENT_EXTRACTIONS = 10; // Maximum number of concurrent extractions
const MAX_EXTRACTION_QUEUE_SIZE = 10000; // Maximum number of concurrent extractions
const DELAY_BETWEEN_EXTRACTIONS = 1000; // Delay in milliseconds between extractions
const CHUNK_SIZE = 10000;

class FileContentStore extends BaseStore<FileContentType> {
  private pendingExtractions: Set<Promise<void>> = new Set();
  private initialSizeWithoutText = 0;
  private extractionQueue: { file: FileContentType; url: string }[] = [];
  private isProcessingQueue = false;

  getFileName(): string {
    return 'file-contents.json';
  }

  private getChunkFileName(chunkIndex: number): string {
    return `file-contents-chunk-${chunkIndex}.json`;
  }

  private getChunkDirectoryPath(): string {
    return path.join(__dirname, '..', '..', 'docs', 'file-contents-chunks');
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

    // Create chunks directory if it doesn't exist
    const chunkDirPath = this.getChunkDirectoryPath();
    const fs = require('fs').promises;
    await fs.mkdir(chunkDirPath, { recursive: true });

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

    // Split items into chunks
    const chunks = [];

    for (let i = 0; i < allItems.length; i += CHUNK_SIZE) {
      chunks.push(allItems.slice(i, i + CHUNK_SIZE));
    }

    // Write each chunk to a separate file
    for (let i = 0; i < chunks.length; i++) {
      const chunkFileName = this.getChunkFileName(i);
      const chunkFilePath = path.join(chunkDirPath, chunkFileName);
      await fs.writeFile(chunkFilePath, JSON.stringify(chunks[i], null, 2), 'utf8');
      console.log(`Wrote chunk ${i} with ${chunks[i].length} items to ${chunkFileName}`);
    }

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

    // Try to load chunks from the chunks directory
    const chunkDirPath = this.getChunkDirectoryPath();
    const fs = require('fs').promises;

    try {
      // Check if chunks directory exists
      await fs.access(chunkDirPath);

      // Get all chunk files
      const files = await fs.readdir(chunkDirPath);
      const chunkFiles = files.filter(
        (file: string) => file.startsWith('file-contents-chunk-') && file.endsWith('.json'),
      );

      console.log(`Found ${chunkFiles.length} chunk files`);

      // Load each chunk
      for (const chunkFile of chunkFiles) {
        const chunkFilePath = path.join(chunkDirPath, chunkFile);
        try {
          const chunkData = JSON.parse(await fs.readFile(chunkFilePath, 'utf8'));

          if (Array.isArray(chunkData)) {
            // Add each item to the map
            for (const item of chunkData) {
              if (item && item.id) {
                itemMap.set(item.id, item);
                this.onItemLoad(item);
              }
            }
          }
        } catch (error) {
          console.error(`Error loading chunk file ${chunkFile}:`, error);
        }
      }
    } catch (error) {
      console.log('No chunks directory found or error accessing it. Using index file only.');

      // If chunks directory doesn't exist, use the index file to create placeholder items
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
