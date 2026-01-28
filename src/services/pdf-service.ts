import axios from 'axios';
import { PDFParse } from 'pdf-parse';
import { correctUrl } from '../utils';
import { PDF_MIME_TYPE } from '../constants';
import { logger } from '../logger';

export class PdfService {
  /**
   * Extracts text from a PDF file at the given URL
   * @param url The URL of the PDF file
   * @returns The extracted text or undefined if extraction failed
   */
  public async extractTextFromPdf(url: string): Promise<string | undefined> {
    let parser: PDFParse | undefined;
    try {
      const correctedUrl = correctUrl(url);

      const response = await axios.get(correctedUrl, {
        responseType: 'arraybuffer',
        headers: { Accept: PDF_MIME_TYPE },
      });

      parser = new PDFParse({ data: response.data });
      const textResult = await parser.getText();
      return textResult.text;
    } catch (error) {
      this.handleExtractionError(error, url);
      return undefined;
    } finally {
      await parser?.destroy();
    }
  }

  private handleExtractionError(error: unknown, originalUrl: string): void {
    if (!axios.isAxiosError(error)) {
      const simplified =
        error instanceof Error
          ? { message: error.message, details: (error as { details?: unknown }).details }
          : error;
      logger.error('PDF download failed', { url: originalUrl, error: simplified });
      return;
    }

    const status = error.response?.status;
    const statusText = error.response?.statusText;
    const url = error.config?.url ?? originalUrl;

    if (status && status >= 400 && status < 500) {
      // 4xx are common for protected or removed files; keep them at debug by default
      logger.debug(`PDF unavailable (${status}${statusText ? ` ${statusText}` : ''})`, {
        url,
      });
      return;
    }

    const simplifiedError =
      error instanceof Error
        ? { message: error.message, details: (error as { details?: unknown }).details }
        : error;

    logger.warn('Error parsing PDF', { url, status, error: simplifiedError });
  }
}

export const pdfService = new PdfService();
