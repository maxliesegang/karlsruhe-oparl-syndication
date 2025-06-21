import axios from 'axios';
import pdf from 'pdf-parse';
import { correctUrl } from '../utils';
import { PDF_MIME_TYPE } from '../constants';

export class PdfService {
  /**
   * Extracts text from a PDF file at the given URL
   * @param url The URL of the PDF file
   * @returns The extracted text or undefined if extraction failed
   */
  public async extractTextFromPdf(url: string): Promise<string | undefined> {
    try {
      const correctedUrl = correctUrl(url);

      const response = await axios.get(correctedUrl, {
        responseType: 'arraybuffer',
        headers: { Accept: PDF_MIME_TYPE },
      });

      const data = await pdf(response.data);
      return data.text;
    } catch (error) {
      this.handleExtractionError(error);
      return undefined;
    }
  }

  private handleExtractionError(error: unknown): void {
    if (!axios.isAxiosError(error)) {
      console.error('Error downloading PDF:', error);
    } else {
      console.log('Error parsing PDF:', error);
    }
  }
}

export const pdfService = new PdfService();
