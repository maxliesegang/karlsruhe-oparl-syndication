import axios, { AxiosInstance } from 'axios';
import { PDFParse } from 'pdf-parse';
import { normalizeOParlUrl } from '../utils.js';
import { createRetryingHttpClient } from '../api/http-client.js';
import { PDF_MIME_TYPE } from '../constants.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

/** Reduces an error to a loggable shape, avoiding noisy stack/circular fields. */
function simplifyError(error: unknown): unknown {
  return error instanceof Error
    ? { message: error.message, details: (error as { details?: unknown }).details }
    : error;
}

export class PdfService {
  // Reuse the project's retry policy so transient 429/503/network failures on a
  // download are retried, matching how OParl collection requests behave.
  private readonly httpClient: AxiosInstance = createRetryingHttpClient();

  /**
   * Extracts text from a PDF file at the given URL
   * @param url The URL of the PDF file
   * @returns The extracted text or undefined if extraction failed
   */
  public async extractTextFromPdf(url: string): Promise<string | undefined> {
    let parser: PDFParse | undefined;
    try {
      const correctedUrl = normalizeOParlUrl(url);

      const response = await this.httpClient.get(correctedUrl, {
        responseType: 'arraybuffer',
        headers: { Accept: PDF_MIME_TYPE },
        timeout: config.pdfDownloadTimeoutMs,
        maxContentLength: config.pdfMaxContentBytes,
        maxBodyLength: config.pdfMaxContentBytes,
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
      logger.error('PDF download failed', { url: originalUrl, error: simplifyError(error) });
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

    logger.warn('Error parsing PDF', { url, status, error: simplifyError(error) });
  }
}

export const pdfService = new PdfService();
