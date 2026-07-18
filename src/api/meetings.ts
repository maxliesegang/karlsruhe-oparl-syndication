import { Meeting } from '../types/index.js';
import { store } from '../store/index.js';
import { config } from '../config.js';
import { fetchAllPages, fetchOne } from './http.js';
import { API_LIMIT } from '../constants.js';
import { logger } from '../logger.js';

export async function fetchAllMeetings(modifiedSince?: Date): Promise<void> {
  const initialUrl = `${config.allMeetingsApiUrl}?limit=${API_LIMIT}`;

  logger.info('Starting to fetch meetings...');

  const { pageCount, totalItems } = await fetchAllPages<Meeting>(
    initialUrl,
    (meetings) => meetings.forEach((meeting) => store.meetings.add(meeting)),
    { modifiedSince, fetchAllPages: config.fetchAllPages },
  );

  logger.info(`Finished fetching ${pageCount} page(s) with ${totalItems} meetings.`);
}

export async function fetchMeeting(url: string): Promise<Meeting | null> {
  logger.debug(`Fetching meeting from: ${url}`);

  const meeting = await fetchOne<Meeting>(url);

  if (meeting) {
    store.meetings.add(meeting);
    logger.debug(`Successfully fetched meeting: ${meeting.id}`);
  }

  return meeting;
}
