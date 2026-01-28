import { Organization } from '../types';
import { store } from '../store';
import { config } from '../config';
import { fetchAllPages } from './http';
import { API_LIMIT } from '../constants';

// Note: Organizations API does not support modified_since parameter
export async function fetchAllOrganizations(): Promise<void> {
  const initialUrl = `${config.allOrganizationsApiUrl}?limit=${API_LIMIT}`;

  console.log('Starting to fetch organizations...');

  const { pageCount, totalItems } = await fetchAllPages<Organization>(
    initialUrl,
    (organizations) => organizations.forEach((org) => store.organizations.add(org)),
    { fetchAllPages: true },
  );

  console.log(`Finished fetching ${pageCount} page(s) with ${totalItems} organizations.`);
}
