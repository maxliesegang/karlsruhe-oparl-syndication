import { Meeting } from '../types/index.js';
import { store } from '../store/index.js';
import { config } from '../config.js';
import { fetchAllPages, fetchOne } from './http.js';
import { API_LIMIT } from '../constants.js';
import { logger } from '../logger.js';

export async function fetchAllMeetings(modifiedSince?: Date): Promise<void> {
  const initialUrl = `${config.allMeetingsApiUrl}?limit=${API_LIMIT}`;

  logger.info('Starting to fetch meetings...');

  const fetchedMeetings: Meeting[] = [];
  const { pageCount, totalItems } = await fetchAllPages<Meeting>(
    initialUrl,
    (meetings) => fetchedMeetings.push(...meetings),
    { modifiedSince, fetchAllPages: config.fetchAllPages },
  );

  // Add-only, matching papers: an absent meeting is not necessarily deleted. Karlsruhe may
  // stop exposing restricted meetings in the collection, and a truncated crawl can drop the
  // tail of the list. Preserve last-known metadata (this is a complete archive) and remove
  // only explicit OParl `deleted` tombstones, which store.add handles. A full reconciliation
  // (modifiedSince undefined) therefore refreshes every current meeting without wiping the rest.
  fetchedMeetings.forEach((meeting) => store.meetings.add(meeting));

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
