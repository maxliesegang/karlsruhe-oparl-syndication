export const COMMITTEE_FEED_DIRECTORY = 'gremien';
export const DISTRICT_FEED_DIRECTORY = 'stadtteile';
export const FILTERED_FEED_INDEX_FILE_NAME = 'feed-index.json';

export type FilteredFeedType = 'committee' | 'district';

/** Stable public schema of docs/feed-index.json. */
export interface FilteredFeedDescriptor {
  type: FilteredFeedType;
  id: string;
  title: string;
  path: string;
  url: string;
  entryCount: number;
}

export function isFilteredFeedPath(value: string): boolean {
  return /^(gremien|stadtteile)\/[A-Za-z0-9._-]+\.xml$/.test(value);
}

/** Produce readable, stable ASCII filenames for German labels. */
export function slugifyFeedSegment(value: string): string {
  return value
    .toLocaleLowerCase('de-DE')
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
