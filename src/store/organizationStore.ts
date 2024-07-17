import { BaseStore } from './baseStore';
import { Organization } from '../types';

class OrganizationStore extends BaseStore<Organization> {
  getFileName(): string {
    return 'organizationStore.json';
  }
}

export const organizationStore = new OrganizationStore();
