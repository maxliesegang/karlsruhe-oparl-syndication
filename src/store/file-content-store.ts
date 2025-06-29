import { BaseStore } from './base-store';
import { config } from '../config';
import { FileContentType } from '../types/file-content-type';
import { pdfService } from '../services/pdf-service';
import { dateService } from '../services/date-service';
import { readJsonFromFile, writeJsonToFile } from '../file-utils';
import path from 'path';
import fs from 'fs/promises';

const MAX_CONCURRENT_EXTRACTIONS = 10; // Maximum number of concurrent extractions
const MAX_EXTRACTION_QUEUE_SIZE = 1000; // Maximum number of concurrent extractions
const DELAY_BETWEEN_EXTRACTIONS = 1000; // Delay in milliseconds between extractions
const CHUNK_SIZE = 1000; // Number of files per chunk

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

  private getChunksDirectoryPath(): string {
    return path.join(__dirname, '..', '..', 'docs', 'file-contents-chunks');
  }

  private getChunkFileName(chunkIndex: number): string {
    return `chunk-${chunkIndex}.json`;
  }

  private getChunkFilePath(chunkIndex: number): string {
    return path.join(this.getChunksDirectoryPath(), this.getChunkFileName(chunkIndex));
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

    // Create chunks directory if it doesn't exist
    const chunksDirPath = this.getChunksDirectoryPath();
    await fs.mkdir(chunksDirPath, { recursive: true });

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

    // Create chunks for faster bulk loading
    // Filter items that have extracted text
    const itemsWithText = allItems.filter((item) => item.extractedText);

    // Create chunks
    const chunks = [];
    for (let i = 0; i < itemsWithText.length; i += CHUNK_SIZE) {
      chunks.push(itemsWithText.slice(i, i + CHUNK_SIZE));
    }

    // Write each chunk to a file
    for (let i = 0; i < chunks.length; i++) {
      const chunkData = chunks[i].map((item) => ({
        id: item.id,
        fileId: this.getFileIdFromUrl(item.id),
        extractedText: item.extractedText,
      }));

      const chunkFilePath = this.getChunkFilePath(i);
      await fs.writeFile(chunkFilePath, JSON.stringify(chunkData), 'utf8');
    }
    console.log(`Wrote ${chunks.length} chunk files to ${chunksDirPath}`);

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

    // Try to load from chunk files first (faster for bulk loading)
    let loadedFromChunks = false;
    const chunksDirPath = this.getChunksDirectoryPath();

    try {
      // Check if chunks directory exists
      await fs.access(chunksDirPath);

      // Get all chunk files
      const files = await fs.readdir(chunksDirPath);
      const chunkFiles = files.filter(
        (file) => file.startsWith('chunk-') && file.endsWith('.json'),
      );

      if (chunkFiles.length > 0) {
        console.log(`Found ${chunkFiles.length} chunk files. Loading from chunks...`);

        // Sort chunk files by index
        chunkFiles.sort((a, b) => {
          const indexA = parseInt(a.replace('chunk-', '').replace('.json', ''));
          const indexB = parseInt(b.replace('chunk-', '').replace('.json', ''));
          return indexA - indexB;
        });

        // Load content from each chunk file
        let totalItemsLoaded = 0;

        for (const chunkFile of chunkFiles) {
          try {
            const chunkFilePath = path.join(chunksDirPath, chunkFile);
            const chunkData = JSON.parse(await fs.readFile(chunkFilePath, 'utf8'));

            if (Array.isArray(chunkData)) {
              for (const chunkItem of chunkData) {
                const item = itemMap.get(chunkItem.id);
                if (item && chunkItem.extractedText) {
                  item.extractedText = chunkItem.extractedText;
                  totalItemsLoaded++;
                }
              }
            }
          } catch (error) {
            console.error(`Error loading chunk file ${chunkFile}:`, error);
          }
        }

        console.log(`Loaded ${totalItemsLoaded} items from chunk files`);
        loadedFromChunks = totalItemsLoaded > 0;
      }
    } catch (error) {
      console.log('No chunks directory found or error accessing it. Will try individual files.');
    }

    // If we couldn't load from chunks, try to load from individual files
    if (!loadedFromChunks) {
      // Try to load individual files from the file content directory
      const contentDirPath = this.getFileContentDirectoryPath();

      try {
        // Check if file content directory exists
        await fs.access(contentDirPath);

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
      } catch (error) {
        console.log(
          'No file content directory found or error accessing it. Using index file only.',
        );
      }
    }

    // Call onItemLoad for each item
    for (const item of itemMap.values()) {
      this.onItemLoad(item);
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
