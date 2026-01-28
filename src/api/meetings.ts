import { Meeting } from '../types';
import { store } from '../store';
import { config } from '../config';
import { fetchAllPages, fetchOne } from './http';
import { API_LIMIT } from '../constants';
import { logger } from '../logger';

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
