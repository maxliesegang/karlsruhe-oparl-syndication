import axios from 'axios';
import { Meeting } from '../types';
import { store } from '../store';
import { config } from '../config';
import { requestQueue, correctUrl, formatDateForUrl } from './common';
import { API_LIMIT } from '../constants';

export async function fetchAllMeetings(modified_since?: Date): Promise<void> {
  let nextUrl: string | null = `${config.allMeetingsApiUrl}?limit=${API_LIMIT}`;
  if (modified_since) {
    const formattedDate = formatDateForUrl(modified_since);
    nextUrl += `&modified_since=${encodeURIComponent(formattedDate)}`;
  }
  let pageCount = 0;
  let totalMeetings = 0;

  console.log('Starting to fetch meetings...');

  while (nextUrl) {
    await requestQueue.add(async () => {
      try {
        const correctedUrl = correctUrl(nextUrl!);
        const response = await axios.get<{ data: Meeting[]; links: { next?: string } }>(
          correctedUrl,
        );
        const meetings = response.data.data;

        meetings.forEach((meeting) => store.meetings.add(meeting));

        pageCount++;
        totalMeetings += meetings.length;
        console.log(
          `Fetched page ${pageCount} with ${meetings.length} meetings. Total meetings: ${totalMeetings}`,
        );

        if (config.fetchAllPages && response.data.links.next) {
          nextUrl = correctUrl(response.data.links.next);
        } else {
          nextUrl = null;
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          console.log(`404 Error: Meeting not found at URL: ${nextUrl}`);
          nextUrl = null; // Stop fetching more pages
        } else {
          console.error('Error fetching meetings:', error);
          throw error;
        }
      }
    });
  }

  console.log(`Finished fetching ${pageCount} page(s) with a total of ${totalMeetings} meetings.`);
}

export async function fetchMeetings(url: string): Promise<Meeting[]> {
  return new Promise((resolve, reject) => {
    requestQueue.add(async () => {
      try {
        console.log(`Fetching meetings from: ${url}`);
        const response = await axios.get<{ data: Meeting[] }>(url);
        console.log(`Successfully fetched ${response.data.data.length} meetings`);
        response.data.data.forEach((meeting) => store.meetings.add(meeting));
        resolve(response.data.data);
      } catch (error) {
        console.error('Error fetching meetings:', error);
        reject(error);
      }
    });
  });
}
