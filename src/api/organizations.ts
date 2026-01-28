import { Organization } from '../types';
import { store } from '../store';
import { config } from '../config';
import { fetchAllPages } from './http';
import { API_LIMIT } from '../constants';
import { logger } from '../logger';

// Note: Organizations API does not support modified_since parameter
export async function fetchAllOrganizations(): Promise<void> {
  const initialUrl = `${config.allOrganizationsApiUrl}?limit=${API_LIMIT}`;

  logger.info('Starting to fetch organizations...');

  const { pageCount, totalItems } = await fetchAllPages<Organization>(
    initialUrl,
    (organizations) => organizations.forEach((org) => store.organizations.add(org)),
    { fetchAllPages: true },
  );

  logger.info(`Finished fetching ${pageCount} page(s) with ${totalItems} organizations.`);
}
