import { Paper } from '../types/index.js';
import { stores } from '../store/index.js';
import { config } from '../config.js';
import { fetchOParlResource, fetchPaginatedCollection } from './http.js';
import { OPARL_PAGE_SIZE } from '../constants.js';
import { logger } from '../logger.js';

export async function synchronizePapers(modifiedSince?: Date): Promise<void> {
  const collectionUrl = `${config.papersApiUrl}?limit=${OPARL_PAGE_SIZE}`;

  logger.info('Starting to fetch papers...');

  // An absent paper is not necessarily deleted: Karlsruhe may stop exposing
  // member-only papers in the collection and return 401 for their resource.
  // Preserve last-known metadata and remove only explicit OParl tombstones.
  // Store each page as it arrives so a failure mid-crawl still persists progress.
  const { pageCount, totalItems } = await fetchPaginatedCollection<Paper>(
    collectionUrl,
    (papers) => papers.forEach((paper) => stores.papers.add(paper)),
    { modifiedSince, followPagination: config.followPagination },
  );

  logger.info(`Finished fetching ${pageCount} page(s) with ${totalItems} papers.`);
}

export async function fetchAndStorePaper(url: string): Promise<Paper | null> {
  logger.debug(`Fetching paper from: ${url}`);

  const paper = await fetchOParlResource<Paper>(url);

  if (paper) {
    stores.papers.add(paper);
    logger.debug(`Successfully fetched paper: ${paper.id}`);
  }

  return paper;
}
