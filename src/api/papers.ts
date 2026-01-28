import { Paper } from '../types';
import { store } from '../store';
import { config } from '../config';
import { fetchAllPages, fetchOne } from './http';
import { API_LIMIT } from '../constants';
import { logger } from '../logger';

export async function fetchAllPapers(modifiedSince?: Date): Promise<void> {
  const initialUrl = `${config.allPapersApiUrl}?limit=${API_LIMIT}`;

  logger.info('Starting to fetch papers...');

  const { pageCount, totalItems } = await fetchAllPages<Paper>(
    initialUrl,
    (papers) => papers.forEach((paper) => store.papers.add(paper)),
    { modifiedSince, fetchAllPages: config.fetchAllPages },
  );

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
