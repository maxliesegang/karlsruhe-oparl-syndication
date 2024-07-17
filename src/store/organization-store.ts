import { BaseStore } from './base-store';
import { Organization } from '../types';

class OrganizationStore extends BaseStore<Organization> {
  getFileName(): string {
    return 'organizations.json';
  }

  getLastModified(): Date | undefined {
    const allDates = Array.from(this.itemStore.values()).map((item) =>
      item.modified ? new Date(item.modified) : new Date(item.created),
    );
    return allDates.length
      ? new Date(Math.max(...allDates.map((date) => date.getTime())))
      : undefined;
  }
}

export const organizationStore = new OrganizationStore();
