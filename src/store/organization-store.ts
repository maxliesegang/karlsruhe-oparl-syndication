import { BaseStore } from './base-store';
import { Organization } from '../types';

class OrganizationStore extends BaseStore<Organization> {
  getFileName(): string {
    return 'organizations.json';
  }
}

export const organizationStore = new OrganizationStore();
