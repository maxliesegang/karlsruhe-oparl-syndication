import axios from 'axios';
import { Paper } from '../types';
import { store } from '../store';
import { correctUrl, formatDateForUrl, requestQueue } from './common';
import { config } from '../config';
import { API_LIMIT } from '../constants';

export async function fetchAllPapers(modified_since?: Date): Promise<void> {
  let nextUrl: string | null = `${config.allPapersApiUrl}?limit=${API_LIMIT}`;

  // Add the modified_since parameter to the initial URL if provided
  if (modified_since) {
    const formattedDate = formatDateForUrl(modified_since);
    nextUrl += `&modified_since=${encodeURIComponent(formattedDate)}`;
  }

  let pageCount = 0;
  let totalPapers = 0;

  console.log('Starting to fetch papers...');

  while (nextUrl) {
    await requestQueue.add(async () => {
      try {
        const correctedUrl = correctUrl(nextUrl!);
        const response = await axios.get<{ data: Paper[]; links: { next?: string } }>(correctedUrl);
        const papers = response.data.data;

        papers.forEach((paper) => store.papers.add(paper));

        pageCount++;
        totalPapers += papers.length;
        console.log(
          `Fetched page ${pageCount} with ${papers.length} papers. Total papers: ${totalPapers}`,
        );

        if (config.fetchAllPages && response.data.links.next) {
          nextUrl = correctUrl(response.data.links.next);
        } else {
          nextUrl = null;
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          console.log(`404 Error: Papers not found at URL: ${nextUrl}`);
          nextUrl = null; // Stop fetching more pages
        } else {
          console.error('Error fetching papers:', error);
          if (axios.isAxiosError(error)) {
            console.error('Axios error details:', error.message);
            if (error.response) {
              console.error('Response status:', error.response.status);
              console.error('Response data:', error.response.data);
            }
          }
          throw error;
        }
      }
    });
  }

  console.log(`Finished fetching ${pageCount} page(s) with a total of ${totalPapers} papers.`);
}

export async function fetchPaper(url: string): Promise<Paper | null> {
  return new Promise((resolve, reject) => {
    requestQueue.add(async () => {
      try {
        console.log(`Fetching paper from: ${url}`);
        const correctedUrl = correctUrl(url);
        const response = await axios.get<Paper>(correctedUrl);
        console.log(`Successfully fetched paper: ${response.data.id}`);
        store.papers.add(response.data);
        resolve(response.data);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          console.log(`Paper not found: ${url}`);
          resolve(null);
          return;
        }
        console.error('Error fetching paper:', error);
        reject(error);
      }
    });
  });
}
