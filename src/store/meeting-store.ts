import { BaseStore } from './base-store';
import { Meeting } from '../types';

class MeetingStore extends BaseStore<Meeting> {
  private organizationMeetings: Map<string, Set<string>> = new Map();

  getFileName(): string {
    return 'meetings.json';
  }

  getLastModified(): Date | undefined {
    const allDates = Array.from(this.itemStore.values()).map((item) =>
      item.modified ? new Date(item.modified) : new Date(item.created),
    );

    if (!allDates.length) return undefined;

    const latestDate = new Date(Math.max(...allDates.map((date) => date.getTime())));
    latestDate.setDate(latestDate.getDate() - 1); // Subtract 1 day

    return latestDate;
  }


  protected async onItemAdd(meeting: Meeting) {
    meeting.organization.forEach((orgId) => {
      if (!this.organizationMeetings.has(orgId)) {
        this.organizationMeetings.set(orgId, new Set());
      }
      const orgMeetings = this.organizationMeetings.get(orgId);
      if (orgMeetings) {
        orgMeetings.add(meeting.id);
      }
    });
  }

  getMeetingsByOrganizationId(organizationId: string): Meeting[] {
    const meetingIds = this.organizationMeetings.get(organizationId);
    if (!meetingIds) {
      return [];
    }
    return Array.from(meetingIds)
      .map((id) => this.getById(id)!)
      .filter(Boolean);
  }
}

export const meetingStore = new MeetingStore();
