// src/api/organizations.ts
import axios from 'axios';
import { Organization } from '../types';
import { store } from '../store';
import { correctUrl, formatDateForUrl } from './common';
import { config } from '../config';
import { API_LIMIT } from '../constants';

export async function fetchAllOrganizations(modified_since?: Date): Promise<void> {
  let nextUrl: string | null = `${config.allOrganizationsApiUrl}?limit=${API_LIMIT}`;
  if (modified_since) {
    const formattedDate = formatDateForUrl(modified_since);
    // nextUrl += `&modified_since=${encodeURIComponent(formattedDate)}`;
  }

  console.log('Starting to fetch organizations...');

  while (nextUrl) {
    try {
      const correctedUrl = correctUrl(nextUrl);
      const response = await axios.get<{ data: Organization[]; links: { next?: string } }>(
        correctedUrl,
      );
      const organizations = response.data.data;

      organizations.forEach((organization) => store.organizations.add(organization));

      console.log(
        `Fetched ${organizations.length} organizations. Total organizations: ${store.organizations.getAllItems().length}`,
      );

      nextUrl = response.data.links.next ? correctUrl(response.data.links.next) : null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log(`404 Error: Meeting not found at URL: ${nextUrl}`);
        nextUrl = null; // Stop fetching more pages
      } else {
        console.error('Error fetching meetings:', error);
        throw error;
      }
    }
  }
}
