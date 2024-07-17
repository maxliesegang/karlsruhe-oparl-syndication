import { meetingStore } from './meetingStore';
import { paperStore } from './paperStore';
import { consultationStore } from './consultationStore';
import { organizationStore } from './organizationStore';

export const store = {
  meetings: meetingStore,
  papers: paperStore,
  consultations: consultationStore,
  organizations: organizationStore,

  async saveAllToDisk() {
    await this.meetings.saveToDisk();
    await this.papers.saveToDisk();
    await this.consultations.saveToDisk();
    await this.organizations.saveToDisk();
  },

  async loadAllFromDisk() {
    await this.meetings.loadFromDisk();
    await this.papers.loadFromDisk();
    await this.consultations.loadFromDisk();
    await this.organizations.loadFromDisk();
  },
};
