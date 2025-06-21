import { BaseStore } from './base-store';
import { config } from '../config';
import { FileContentType } from '../types/file-content-type';
import { pdfService } from '../services/pdf-service';
import { dateService } from '../services/date-service';

class FileContentStore extends BaseStore<FileContentType> {
  private pendingExtractions: Set<Promise<void>> = new Set();
  private initialSizeWithoutText = 0;

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

    if (config.extractPdfText && file.fileModified !== file.lastModifiedExtractedDate) {
      await this.extractAndSavePdfText(file, file.downloadUrl);
    }
  }

  private async extractAndSavePdfText(file: FileContentType, url: string): Promise<void> {
    const extractionPromise = (async () => {
      const extractedText = await pdfService.extractTextFromPdf(url);

      if (extractedText) {
        file.extractedText = extractedText;
        file.lastModifiedExtractedDate = file.fileModified;
      }
    })();

    this.pendingExtractions.add(extractionPromise);

    try {
      await extractionPromise;
    } finally {
      this.pendingExtractions.delete(extractionPromise);
    }
  }

  async persistItemsToFile(): Promise<void> {
    await Promise.all(this.pendingExtractions);
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
