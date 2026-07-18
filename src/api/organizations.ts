import { Organization } from '../types/index.js';
import { stores } from '../store/index.js';
import { config } from '../config.js';
import { fetchPaginatedCollection } from './http.js';
import { OPARL_PAGE_SIZE } from '../constants.js';
import { logger } from '../logger.js';

// Note: Organizations API does not support modified_since parameter
export async function synchronizeOrganizations(): Promise<void> {
  const collectionUrl = `${config.organizationsApiUrl}?limit=${OPARL_PAGE_SIZE}`;

  logger.info('Starting to fetch organizations...');

  const receivedOrganizations: Organization[] = [];
  const { pageCount, totalItems } = await fetchPaginatedCollection<Organization>(
    collectionUrl,
    (organizations) => receivedOrganizations.push(...organizations),
    { followPagination: true },
  );
  // Add-only, matching meetings and papers: preserve dissolved or restricted organizations so
  // historical meetings can still resolve their organization names. Remove only explicit
  // OParl `deleted` tombstones (handled by stores.add).
  receivedOrganizations.forEach((organization) => stores.organizations.add(organization));

  logger.info(`Finished fetching ${pageCount} page(s) with ${totalItems} organizations.`);
}
