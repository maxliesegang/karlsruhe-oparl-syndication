import { meetingStore } from './meeting-store';
import { paperStore } from './paper-store';
import { consultationStore } from './consultation-store';
import { organizationStore } from './organization-store';
import { fileContentStore } from './file-content-store';

export const store = {
  meetings: meetingStore,
  papers: paperStore,
  consultations: consultationStore,
  organizations: organizationStore,
  fileContentStore: fileContentStore,

  async saveAllToDisk() {
    await this.meetings.persistItemsToFile();
    await this.papers.persistItemsToFile();
    await this.consultations.persistItemsToFile();
    await this.organizations.persistItemsToFile();
    await this.fileContentStore.persistItemsToFile();
  },

  async loadAllFromDisk() {
    await this.meetings.loadItemsFromFile();
    await this.papers.loadItemsFromFile();
    await this.consultations.loadItemsFromFile();
    await this.organizations.loadItemsFromFile();
    await this.fileContentStore.loadItemsFromFile();
  },

  clearAllFromCache(): void {
    this.meetings.clearAllItems();
    this.papers.clearAllItems();
    this.consultations.clearAllItems();
    this.organizations.clearAllItems();
    this.fileContentStore.clearAllItems();
  },
};
