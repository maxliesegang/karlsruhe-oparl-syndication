import axios from 'axios';
import pdf from 'pdf-parse';
import { correctUrl } from './utils';
import { config } from './config';
import { getCachedData, setCachedData } from './cache';
import { PDF_MIME_TYPE } from './constants';

export async function extractPdfText(url: string): Promise<{ link: string; text: string } | null> {
  try {
    const correctedUrl = correctUrl(url);

    const cachedData = await getCachedData(correctedUrl);
    if (cachedData) {
      console.log(`Using cached PDF data for ${correctedUrl}`);
      return cachedData;
    }

    const response = await axios.get(correctedUrl, {
      responseType: 'arraybuffer',
      headers: { Accept: PDF_MIME_TYPE },
    });
    let extractedText = '';
    if (config.extractPdfText) {
      const data = await pdf(response.data);
      extractedText = data.text;
    }

    const result = {
      link: correctedUrl,
      text: extractedText,
    };

    await setCachedData(correctedUrl, result);
    return result;
  } catch (error) {
    console.error('Error downloading or parsing PDF:', error);
    return null;
  }
}
