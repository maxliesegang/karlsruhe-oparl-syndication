import { Meeting } from '../types/index.js';
import { stores } from '../store/index.js';
import { config } from '../config.js';
import { fetchOParlResource, fetchPaginatedCollection } from './http.js';
import { OPARL_PAGE_SIZE } from '../constants.js';
import { logger } from '../logger.js';

export async function synchronizeMeetings(modifiedSince?: Date): Promise<void> {
  const collectionUrl = `${config.meetingsApiUrl}?limit=${OPARL_PAGE_SIZE}`;

  logger.info('Starting to fetch meetings...');

  const receivedMeetings: Meeting[] = [];
  const { pageCount, totalItems } = await fetchPaginatedCollection<Meeting>(
    collectionUrl,
    (meetings) => receivedMeetings.push(...meetings),
    { modifiedSince, followPagination: config.followPagination },
  );

  // Add-only, matching papers: an absent meeting is not necessarily deleted. Karlsruhe may
  // stop exposing restricted meetings in the collection, and a truncated crawl can drop the
  // tail of the list. Preserve last-known metadata (this is a complete archive) and remove
  // only explicit OParl `deleted` tombstones, which stores.add handles. A full reconciliation
  // (modifiedSince undefined) therefore refreshes every current meeting without wiping the rest.
  receivedMeetings.forEach((meeting) => stores.meetings.add(meeting));

  logger.info(`Finished fetching ${pageCount} page(s) with ${totalItems} meetings.`);
}

export async function fetchAndStoreMeeting(url: string): Promise<Meeting | null> {
  logger.debug(`Fetching meeting from: ${url}`);

  const meeting = await fetchOParlResource<Meeting>(url);

  if (meeting) {
    stores.meetings.add(meeting);
    logger.debug(`Successfully fetched meeting: ${meeting.id}`);
  }

  return meeting;
}
