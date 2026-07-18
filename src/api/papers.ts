import { Paper } from '../types/index.js';
import { store } from '../store/index.js';
import { config } from '../config.js';
import { fetchAllPages, fetchOne } from './http.js';
import { API_LIMIT } from '../constants.js';
import { logger } from '../logger.js';

export async function fetchAllPapers(modifiedSince?: Date): Promise<void> {
  const initialUrl = `${config.allPapersApiUrl}?limit=${API_LIMIT}`;

  logger.info('Starting to fetch papers...');

  const fetchedPapers: Paper[] = [];
  const { pageCount, totalItems } = await fetchAllPages<Paper>(
    initialUrl,
    (papers) => fetchedPapers.push(...papers),
    { modifiedSince, fetchAllPages: config.fetchAllPages },
  );

  // An absent paper is not necessarily deleted: Karlsruhe may stop exposing
  // member-only papers in the collection and return 401 for their resource.
  // Preserve last-known metadata and remove only explicit OParl tombstones.
  fetchedPapers.forEach((paper) => store.papers.add(paper));

  logger.info(`Finished fetching ${pageCount} page(s) with ${totalItems} papers.`);
}

export async function fetchPaper(url: string): Promise<Paper | null> {
  logger.debug(`Fetching paper from: ${url}`);

  const paper = await fetchOne<Paper>(url);

  if (paper) {
    store.papers.add(paper);
    logger.debug(`Successfully fetched paper: ${paper.id}`);
  }

  return paper;
}
