import { BaseStore } from './base-store';
import { config } from '../config';
import { FileContentType } from '../types/file-content-type';
import { pdfService } from '../services/pdf-service';
import { dateService } from '../services/date-service';

class FileContentStore extends BaseStore<FileContentType> {
  private pendingExtractions: Set<Promise<void>> = new Set();
  private initialSizeWithoutText = 0;
  private extractionQueue: { file: FileContentType; url: string }[] = [];
  private isProcessingQueue = false;
  private readonly MAX_CONCURRENT_EXTRACTIONS = 10; // Maximum number of concurrent extractions
  private readonly MAX_EXTRACTION_QUEUE_SIZE = 5000; // Maximum number of concurrent extractions
  private readonly DELAY_BETWEEN_EXTRACTIONS = 1000; // Delay in milliseconds between extractions

  getFileName(): string {
    return 'file-contents.json';
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
    if (this.extractionQueue.length < this.MAX_EXTRACTION_QUEUE_SIZE) {
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
    const currentBatch = this.extractionQueue.splice(0, this.MAX_CONCURRENT_EXTRACTIONS);
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
      `Batch processing completed. Adding delay of ${this.DELAY_BETWEEN_EXTRACTIONS}ms before next batch`,
    );

    // Add a delay before processing the next batch
    await new Promise((resolve) => setTimeout(resolve, this.DELAY_BETWEEN_EXTRACTIONS));

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
    await super.persistItemsToFile();
    const filesWithoutText = Array.from(this.itemStore.values()).filter(
      (file) => !file.lastModifiedExtractedDate,
    );
    console.log(`Initial ${this.initialSizeWithoutText} files without text`);
    console.log(`${filesWithoutText.length}/${this.itemStore.size} files without text`);
  }

  async loadItemsFromFile(): Promise<void> {
    await super.loadItemsFromFile();
    this.initialSizeWithoutText = Array.from(this.itemStore.values()).filter(
      (file) => !file.lastModifiedExtractedDate,
    ).length;
  }
}

export const fileContentStore = new FileContentStore();
