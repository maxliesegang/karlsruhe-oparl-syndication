import { meetingStore } from './meeting-store.js';
import { paperStore } from './paper-store.js';
import { consultationStore } from './consultation-store.js';
import { organizationStore } from './organization-store.js';
import { fileContentStore } from './file-content-store.js';

export const stores = {
  meetings: meetingStore,
  papers: paperStore,
  consultations: consultationStore,
  organizations: organizationStore,
  fileContents: fileContentStore,

  async saveToDisk() {
    await this.meetings.saveToDisk();
    await this.papers.saveToDisk();
    await this.consultations.saveToDisk();
    await this.organizations.saveToDisk();
    await this.fileContents.saveToDisk();
  },

  async loadFromDisk() {
    await this.meetings.loadFromDisk();
    await this.papers.loadFromDisk();
    await this.consultations.loadFromDisk();
    await this.organizations.loadFromDisk();
    await this.fileContents.loadFromDisk();
  },

  clear(): void {
    this.meetings.clear();
    this.papers.clear();
    this.consultations.clear();
    this.organizations.clear();
    this.fileContents.clear();
  },
};
