import { BaseStore } from './base-store.js';
import { Organization } from '../types/index.js';

class OrganizationStore extends BaseStore<Organization> {
  readonly storageFileName = 'organizations.json';
}

export const organizationStore = new OrganizationStore();
