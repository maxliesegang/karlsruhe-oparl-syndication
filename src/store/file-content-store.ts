import { BaseStore } from './base-store';
import { correctUrl } from '../utils';
import { config } from '../config';
import { FileContentType } from '../types/file-content-type';
import axios from 'axios';
import { PDF_MIME_TYPE } from '../constants';
import pdf from 'pdf-parse';

class FileContentStore extends BaseStore<FileContentType> {
  private pendingExtractions: Set<Promise<void>> = new Set();

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
    const isCurrentFile =
      file.fileModified.includes('2025') ||
      file.fileModified.includes('2024') ||
      file.fileModified.includes('2023');
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
      try {
        const correctedUrl = correctUrl(url);

        const response = await axios.get(correctedUrl, {
          responseType: 'arraybuffer',
          headers: { Accept: PDF_MIME_TYPE },
        });

        const data = await pdf(response.data);

        file.extractedText = data.text;
        file.lastModifiedExtractedDate = file.fileModified;
      } catch (error) {
        if (!axios.isAxiosError(error)) {
          console.error('Error downloading PDF:', error);
        } else {
          console.log('Error parsing PDF:', error);
        }
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
    console.log(`${filesWithoutText.length}/${this.itemStore.size} files without text`);
  }
}

export const fileContentStore = new FileContentStore();
