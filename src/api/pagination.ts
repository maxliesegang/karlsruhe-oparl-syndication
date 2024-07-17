// src/utils/pagination.ts
import axios from 'axios';
import { correctUrl } from '../utils';

export async function fetchAllPages<T>(
  initialUrl: string,
  processPage: (items: T[]) => void,
): Promise<void> {
  let nextUrl: string | null = initialUrl;

  while (nextUrl) {
    try {
      const correctedUrl = correctUrl(nextUrl);
      const response = await axios.get<{ data: T[]; links: { next?: string } }>(correctedUrl);
      const items = response.data.data;

      processPage(items);

      nextUrl = response.data.links.next ? correctUrl(response.data.links.next) : null;
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }
  }
}
