import { Meeting } from '../types';
import { store } from '../store';
import { config } from '../config';
import { fetchAllPages, fetchOne } from './http';
import { API_LIMIT } from '../constants';

export async function fetchAllMeetings(modifiedSince?: Date): Promise<void> {
  const initialUrl = `${config.allMeetingsApiUrl}?limit=${API_LIMIT}`;

  console.log('Starting to fetch meetings...');

  const { pageCount, totalItems } = await fetchAllPages<Meeting>(
    initialUrl,
    (meetings) => meetings.forEach((meeting) => store.meetings.add(meeting)),
    { modifiedSince, fetchAllPages: config.fetchAllPages },
  );

  console.log(`Finished fetching ${pageCount} page(s) with ${totalItems} meetings.`);
}

export async function fetchMeeting(url: string): Promise<Meeting | null> {
  console.log(`Fetching meeting from: ${url}`);

  const meeting = await fetchOne<Meeting>(url);

  if (meeting) {
    store.meetings.add(meeting);
    console.log(`Successfully fetched meeting: ${meeting.id}`);
  }

  return meeting;
}
