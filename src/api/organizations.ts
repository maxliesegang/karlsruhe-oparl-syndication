import { Organization } from '../types/index.js';
import { store } from '../store/index.js';
import { config } from '../config.js';
import { fetchAllPages } from './http.js';
import { API_LIMIT } from '../constants.js';
import { logger } from '../logger.js';

// Note: Organizations API does not support modified_since parameter
export async function fetchAllOrganizations(): Promise<void> {
  const initialUrl = `${config.allOrganizationsApiUrl}?limit=${API_LIMIT}`;

  logger.info('Starting to fetch organizations...');

  const fetchedOrganizations: Organization[] = [];
  const { pageCount, totalItems } = await fetchAllPages<Organization>(
    initialUrl,
    (organizations) => fetchedOrganizations.push(...organizations),
    { fetchAllPages: true },
  );
  // Add-only, matching meetings and papers: preserve dissolved or restricted organizations so
  // historical meetings can still resolve their organization names. Remove only explicit
  // OParl `deleted` tombstones (handled by store.add).
  fetchedOrganizations.forEach((organization) => store.organizations.add(organization));

  logger.info(`Finished fetching ${pageCount} page(s) with ${totalItems} organizations.`);
}
