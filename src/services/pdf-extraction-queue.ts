import { pdfService } from './pdf-service';

const MAX_CONCURRENT = 10;
const MAX_QUEUE_SIZE = 1000;
const BATCH_DELAY_MS = 1000;

interface ExtractionItem {
  url: string;
  onSuccess: (text: string) => void;
}

/**
 * Manages a queue for PDF text extraction with rate limiting.
 * Processes extractions in batches to avoid overwhelming the server.
 */
class PdfExtractionQueue {
  private queue: ExtractionItem[] = [];
  private pendingExtractions = new Set<Promise<void>>();
  private isProcessing = false;

  /** Adds an extraction task to the queue */
  add(url: string, onSuccess: (text: string) => void): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      console.log(`Extraction queue full, skipping: ${url}`);
      return;
    }

    this.queue.push({ url, onSuccess });
    console.log(`Added PDF extraction to queue. Queue size: ${this.queue.length}`);

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /** Waits for all pending extractions to complete */
  async waitForCompletion(): Promise<void> {
    while (this.isProcessing || this.queue.length > 0) {
      await delay(500);
    }

    if (this.pendingExtractions.size > 0) {
      console.log(`Waiting for ${this.pendingExtractions.size} pending extractions`);
      await Promise.all(this.pendingExtractions);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      console.log('Extraction queue processing completed');
      return;
    }

    this.isProcessing = true;
    const batch = this.queue.splice(0, MAX_CONCURRENT);
    console.log(`Processing ${batch.length} extractions. Remaining: ${this.queue.length}`);

    const batchPromises = batch.map(({ url, onSuccess }) => this.extractOne(url, onSuccess));
    await Promise.all(batchPromises);

    await delay(BATCH_DELAY_MS);
    await this.processQueue();
  }

  private async extractOne(url: string, onSuccess: (text: string) => void): Promise<void> {
    const extraction = (async () => {
      console.log(`Extracting text from PDF: ${url}`);
      const text = await pdfService.extractTextFromPdf(url);

      if (text) {
        onSuccess(text);
        console.log(`Successfully extracted text from: ${url}`);
      } else {
        console.log(`Failed to extract text from: ${url}`);
      }
    })();

    this.pendingExtractions.add(extraction);
    try {
      await extraction;
    } finally {
      this.pendingExtractions.delete(extraction);
    }
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const pdfExtractionQueue = new PdfExtractionQueue();
